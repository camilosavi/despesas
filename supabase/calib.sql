-- Um Tostão: faturas para calibrar (rodar uma vez em SQL Editor, depois do sync.sql).
-- Quem importa uma fatura de banco que o app não conhece pode tocar em "Enviar o formato": vai só a estrutura
-- mascarada (letras viram X, números viram 9). Qualquer usuário logado só consegue ENVIAR; só quem está em
-- calib_admins consegue ler, marcar como feito e apagar.
create table if not exists calib (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  bank text,
  kind text,
  diag text not null check (length(diag) < 300000),
  done boolean not null default false
);
create table if not exists calib_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table calib enable row level security;
alter table calib_admins enable row level security;

drop policy if exists calib_send on calib;
create policy calib_send on calib for insert to authenticated with check (user_id = auth.uid());
drop policy if exists calib_admin_read on calib;
create policy calib_admin_read on calib for select to authenticated
  using (exists (select 1 from calib_admins a where a.user_id = auth.uid()));
drop policy if exists calib_admin_edit on calib;
create policy calib_admin_edit on calib for update to authenticated
  using (exists (select 1 from calib_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from calib_admins a where a.user_id = auth.uid()));
drop policy if exists calib_admin_del on calib;
create policy calib_admin_del on calib for delete to authenticated
  using (exists (select 1 from calib_admins a where a.user_id = auth.uid()));
drop policy if exists calib_admins_self on calib_admins;
create policy calib_admins_self on calib_admins for select to authenticated using (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update, delete on calib to authenticated;
grant select on calib_admins to authenticated;

-- Troque SEU_EMAIL pelo e-mail com que você entra no app (fica só no seu banco, não no repositório):
insert into calib_admins (user_id) select id from auth.users where email = 'SEU_EMAIL' on conflict do nothing;
