-- 10 · Storage buckets
--
-- Private bucket for CV files. storage.objects has RLS enabled with no policies by default,
-- so no client can read/write objects; the trusted backend (service_role) issues signed
-- upload/download URLs and stores the returned path in cvs.storage_path.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cvs',
  'cvs',
  false,
  10485760,  -- 10 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;
