-- storage.objects has RLS on with no policies, so no client can reach an object; the trusted
-- backend issues signed upload/download URLs and stores the path in cvs.storage_path.
--
-- Avatars and tenant logos are the exception to that reading rule: a photo is rendered by an
-- <img> in three portals, a logo by one on a page a signed-out visitor reads, and a signed URL
-- per render would expire mid-page — so both buckets are public-read. Writes stay backend-only
-- either way. Their limits are the outer envelope on what a client may hand us; the backend
-- re-encodes every upload to a 512x512 WebP before it lands.
--
-- One bucket each rather than one shared one: a logo is a Tenant's and a photo is a Candidate's,
-- and the two are deleted on different occasions by different code.

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
  ),
  (
    'tenant-logos',
    'tenant-logos',
    true,
    null,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do nothing;
