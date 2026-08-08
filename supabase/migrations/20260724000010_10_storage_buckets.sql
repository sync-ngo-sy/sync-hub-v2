-- storage.objects has RLS on with no policies, so no client can reach an object; the trusted
-- backend issues signed upload/download URLs and stores the path in cvs.storage_path.
--
-- Avatars are the one exception to that reading rule: a candidate's photo is rendered by an
-- <img> in three portals, and a signed URL per render would expire mid-page, so the bucket is
-- public-read. Writes stay backend-only either way. Its limits are the outer envelope on what a
-- client may hand us; the backend re-encodes every upload to a 512x512 WebP before it lands.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'cvs',
    'cvs',
    false,
    10485760,  -- 10 MB
    array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  ),
  (
    'avatars',
    'avatars',
    true,
    null,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do nothing;
