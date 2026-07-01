-- =============================================================
-- generations: 生成ジョブの状態と結果を保持するテーブル
--   非同期なので「投入時に queued 行を作り、Webhookで completed/failed に更新」する。
--   UIはこのテーブルを Supabase Realtime で購読して完了を即反映する。
-- =============================================================
create table if not exists public.generations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  ref_id      text not null,                 -- 予約/Higgsfield request_id と一致
  prompt      text not null,
  status      text not null default 'queued' -- queued | processing | completed | failed
              check (status in ('queued','processing','completed','failed')),
  result_url  text,                          -- 完了時に入る画像URL
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists generations_ref_uniq on public.generations (ref_id);
create index if not exists generations_user_idx
  on public.generations (user_id, created_at desc);

alter table public.generations enable row level security;

-- 本人の生成のみ閲覧可（Realtimeもこのポリシーに従う）。
drop policy if exists "own generations readable" on public.generations;
create policy "own generations readable" on public.generations
  for select using (auth.uid() = user_id);

-- 書き込みは service-role 経由のRPC/サーバールートのみ（ポリシー未付与＝拒否）。

-- Realtime 配信を有効化（このテーブルの変更をクライアントへ流す）。
alter publication supabase_realtime add table public.generations;
