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

-- Com "Automatically expose new tables" desligado, libere so o que o app usa (apenas usuario logado).
grant usage on schema public to authenticated;
grant select, insert, update, delete on accts, entries to authenticated;

-- Categorias dos lançamentos (21/10/2026). Quem já rodou o esquema acima roda só esta linha.
alter table entries add column if not exists cat text;

-- Caixinhas (21/10/2026): 1 linha por caixinha, movimentos dentro (jsonb). Quem já rodou o esquema acima roda só este bloco.
create table if not exists boxes (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text,
  icon text,
  cur text not null default 'BRL' check (cur in ('BRL','EUR','USD')),
  goal_cents bigint,
  target text,
  moves jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
alter table boxes enable row level security;
drop policy if exists own_boxes on boxes;
create policy own_boxes on boxes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on boxes to authenticated;
