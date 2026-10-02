-- Parri · файловое хранилище.
-- avatars:    публичный, путь {user_id}/avatar-*.jpg, писать можно только в свою папку.
-- task-files: приватный, путь {user_id}/{task_id}/{brief|chat|submission}/{uuid}-{name}.
--   Загружать можно только в свою папку. Читать:
--   brief      — все, кто видит задачу;
--   chat, submission — только участники задачи (заказчик и исполнитель).

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('avatars', 'avatars', true, 5242880),
  ('task-files', 'task-files', false, 52428800)
on conflict (id) do nothing;

create or replace function private.safe_uuid(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

create policy avatars_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');
create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy task_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'task-files'
  and (storage.foldername(name))[1] = auth.uid()::text
  and private.safe_uuid((storage.foldername(name))[2]) is not null
  and (storage.foldername(name))[3] in ('brief', 'chat', 'submission')
);

create policy task_files_read on storage.objects for select to authenticated using (
  bucket_id = 'task-files' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (
      (storage.foldername(name))[3] = 'brief'
      and private.can_view_task(private.safe_uuid((storage.foldername(name))[2]))
    )
    or (
      (storage.foldername(name))[3] in ('chat', 'submission')
      and private.is_task_participant(private.safe_uuid((storage.foldername(name))[2]))
    )
    or private.is_staff()
  )
);

create policy task_files_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'task-files' and (storage.foldername(name))[1] = auth.uid()::text);

revoke all on function private.safe_uuid(text) from public;
grant execute on function private.safe_uuid(text) to anon, authenticated, service_role;
