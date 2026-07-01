-- =============================================================
-- IDATSUKA credit system
-- 非同期生成（Higgsfield）に対応した予約→確定/返金モデル
-- すべてのRPCはアトミック & 冪等
-- =============================================================

-- 1) 残高テーブル -----------------------------------------------
create table if not exists public.credits (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  balance     integer not null default 0 check (balance >= 0),
  updated_at  timestamptz not null default now()
);

-- 2) 台帳（すべての増減を1行ずつ記録） -------------------------
--    kind:  purchase | reserve | confirm | refund
--    status: reserved | confirmed | refunded
--    ref_id: 冪等キー。
--            - 生成: Higgsfield の request_id（未確定なら内部発行のUUID）
--            - 購入: Stripe の event_id
create table if not exists public.credit_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('purchase','reserve','confirm','refund')),
  amount      integer not null,          -- 正:付与 / 負:消費（reserveは負）
  status      text,                      -- reserve系のライフサイクル
  ref_id      text not null,             -- 冪等キー（kindとの組で一意）
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 冪等性の要。 同じ (kind, ref_id) は二度と挿入できない。
create unique index if not exists credit_tx_kind_ref_uniq
  on public.credit_transactions (kind, ref_id);

create index if not exists credit_tx_user_idx
  on public.credit_transactions (user_id, created_at desc);

-- RLS: 台帳と残高は本人のみ閲覧可。書き込みはRPC(security definer)経由のみ。
alter table public.credits enable row level security;
alter table public.credit_transactions enable row level security;

drop policy if exists "own credits readable" on public.credits;
create policy "own credits readable" on public.credits
  for select using (auth.uid() = user_id);

drop policy if exists "own tx readable" on public.credit_transactions;
create policy "own tx readable" on public.credit_transactions
  for select using (auth.uid() = user_id);

-- =============================================================
-- RPC 1: reserve_credits
--   生成の「前」に呼ぶ。残高が足りればアトミックに引いて予約行を作る。
--   足りなければ例外。 二重予約(同じp_ref_id)は無視して既存を返す。
-- =============================================================
create or replace function public.reserve_credits(
  p_user_id uuid,
  p_amount  integer,
  p_ref_id  text
)
returns integer                       -- 予約後の残高
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_exists  integer;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  -- 冪等: すでに同じ予約があれば現在残高を返して終了
  select 1 into v_exists
  from credit_transactions
  where kind = 'reserve' and ref_id = p_ref_id;
  if found then
    select balance into v_balance from credits where user_id = p_user_id;
    return v_balance;
  end if;

  -- 残高を条件付きで引く（マイナスにならない場合のみ更新される）
  update credits
    set balance = balance - p_amount,
        updated_at = now()
  where user_id = p_user_id
    and balance >= p_amount
  returning balance into v_balance;

  if not found then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  insert into credit_transactions (user_id, kind, amount, status, ref_id)
  values (p_user_id, 'reserve', -p_amount, 'reserved', p_ref_id);

  return v_balance;
end;
$$;

-- =============================================================
-- RPC 2: confirm_credits
--   Higgsfield が completed を返したら呼ぶ。
--   予約を確定するだけ（残高はreserveで既に引かれているので触らない）。
--   二重呼び出しは無視。
-- =============================================================
create or replace function public.confirm_credits(
  p_ref_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update credit_transactions
    set status = 'confirmed', updated_at = now()
  where kind = 'reserve'
    and ref_id = p_ref_id
    and status = 'reserved';       -- reserved のときだけ遷移（冪等）
end;
$$;

-- =============================================================
-- RPC 3: refund_credits
--   Higgsfield が failed を返した / タイムアウトした場合に呼ぶ。
--   予約が reserved のときだけ残高を戻し、refunded に遷移。
--   二重返金は起きない（status ガード）。
-- =============================================================
create or replace function public.refund_credits(
  p_ref_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_amount  integer;   -- reserve時は負の値
begin
  -- 対象の予約を排他ロックして取得
  select user_id, amount into v_user_id, v_amount
  from credit_transactions
  where kind = 'reserve'
    and ref_id = p_ref_id
    and status = 'reserved'
  for update;

  if not found then
    return;            -- 既に確定/返金済み or 存在しない → 何もしない
  end if;

  update credits
    set balance = balance + (-v_amount),   -- 引いた分を戻す
        updated_at = now()
  where user_id = v_user_id;

  update credit_transactions
    set status = 'refunded', updated_at = now()
  where kind = 'reserve' and ref_id = p_ref_id;

  insert into credit_transactions (user_id, kind, amount, status, ref_id)
  values (v_user_id, 'refund', -v_amount, 'refunded', p_ref_id);
end;
$$;

-- =============================================================
-- RPC 4: grant_credits
--   Stripe の checkout.session.completed で呼ぶ購入付与。
--   p_ref_id に Stripe event_id を渡す → 二重付与を防止。
-- =============================================================
create or replace function public.grant_credits(
  p_user_id uuid,
  p_amount  integer,
  p_ref_id  text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  -- 冪等: 同じ event_id での付与は一度だけ
  insert into credit_transactions (user_id, kind, amount, status, ref_id)
  values (p_user_id, 'purchase', p_amount, null, p_ref_id)
  on conflict (kind, ref_id) do nothing;

  if not found then
    -- 既に処理済み → 現残高を返す
    select balance into v_balance from credits where user_id = p_user_id;
    return coalesce(v_balance, 0);
  end if;

  insert into credits (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id)
    do update set balance = credits.balance + excluded.balance,
                  updated_at = now()
  returning balance into v_balance;

  return v_balance;
end;
$$;

-- =============================================================
-- RPC 5: expire_stale_reservations
--   cronで定期実行。 一定時間 reserved のまま放置されたジョブを返金。
--   （Webhookが来なかった / 取りこぼした場合の保険）
-- =============================================================
create or replace function public.expire_stale_reservations(
  p_older_than interval default interval '30 minutes'
)
returns integer                       -- 返金した件数
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select ref_id from credit_transactions
    where kind = 'reserve'
      and status = 'reserved'
      and created_at < now() - p_older_than
  loop
    perform refund_credits(r.ref_id);
    n := n + 1;
  end loop;
  return n;
end;
$$;
