-- =============================================================
-- 新規ユーザー登録時に credits 行を自動作成する。
--   - 残高行が無いと購入前の生成で詰まるのを防ぐ
--   - 初回お試しクレジット（WELCOME_CREDITS）を付与
--   auth.users への insert をトリガーにするのが最も確実。
-- =============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  welcome_credits integer := 30;   -- お試し配布量（3生成ぶん）。運用で調整可
begin
  insert into public.credits (user_id, balance)
  values (new.id, welcome_credits)
  on conflict (user_id) do nothing;

  -- 台帳にも記録（冪等キーは 'welcome:' + user_id）
  if welcome_credits > 0 then
    insert into public.credit_transactions (user_id, kind, amount, status, ref_id)
    values (new.id, 'purchase', welcome_credits, null, 'welcome:' || new.id::text)
    on conflict (kind, ref_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
