-- Um Tostão: foto do recibo em cada lançamento (rodar uma vez em SQL Editor, depois do sync.sql).
-- Bucket privado "recibos"; cada pessoa só lê, grava e apaga arquivos na própria pasta (<user_id>/...).
-- O app reduz a foto para ~1280 px (JPEG, ~150 KB) antes de enviar, para caber no plano grátis (1 GB de arquivos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recibos', 'recibos', false, 2097152, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];

drop policy if exists recibos_read on storage.objects;
create policy recibos_read on storage.objects for select to authenticated
  using (bucket_id = 'recibos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists recibos_insert on storage.objects;
create policy recibos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'recibos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists recibos_delete on storage.objects;
create policy recibos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'recibos' and (storage.foldername(name))[1] = auth.uid()::text);
