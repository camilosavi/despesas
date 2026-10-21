-- Minhas Despesas: banco no Supabase (rodar uma vez em SQL Editor).
-- Cada linha pertence a um usuario (user_id); RLS garante que ninguem le ou escreve dados de outro.
create table if not exists accts (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text,
  label text,
  start_cents bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists entries (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  acct text not null references accts(id) on delete cascade,
  type text not null check (type in ('rec','desp')),
  cents bigint not null check (cents >= 0),
  date date not null,
  descr text not null default '',
  imp text,
  xfer boolean not null default false,
  tr text,
  items jsonb,
  at bigint,
  updated_at timestamptz not null default now()
);
create index if not exists entries_user_date on entries(user_id, date desc);
create unique index if not exists entries_user_imp on entries(user_id, imp) where imp is not null;

alter table accts enable row level security;
alter table entries enable row level security;
drop policy if exists own_accts on accts;
drop policy if exists own_entries on entries;
create policy own_accts on accts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_entries on entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
