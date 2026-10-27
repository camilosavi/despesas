-- Um Tostão: sincronização no Supabase (rodar uma vez em SQL Editor).
-- Uma linha por lançamento / compra de moeda / chave de configuração. O conteúdo vai em `data` ({"v": ...}).
-- RLS: cada usuário só lê e escreve as próprias linhas.
-- kind: i = lançamento, f = compra de moeda, c = chave do cfg, p = foto e tema, d = lápide (apagado), m = quem enviou por último.
create table if not exists sync_rows (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('i','f','c','p','d','m')),
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);

alter table sync_rows enable row level security;
drop policy if exists own_rows on sync_rows;
create policy own_rows on sync_rows for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Com "Automatically expose new tables" desligado, libere só o que o app usa (apenas usuário logado).
grant usage on schema public to authenticated;
grant select, insert, update, delete on sync_rows to authenticated;
