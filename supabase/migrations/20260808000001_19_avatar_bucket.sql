-- Avatars are public-read, unlike CVs: a candidate's photo is rendered by an <img> in three
-- portals, and a signed URL per render would expire mid-page. Writes stay backend-only the same
-- way CVs do — storage.objects has RLS on with no policies, so only the service role gets in.
-- The limits below are the outer envelope on what a client may hand us; the backend re-encodes
-- every upload to a 512x512 WebP before it reaches this bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
