-- Create a public storage bucket for uploaded images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read on all images
CREATE POLICY "public_read_images" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'images');

-- Allow anon/authenticated to upload
CREATE POLICY "anon_upload_images" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'images');

-- Allow anon/authenticated to update
CREATE POLICY "anon_update_images" ON storage.objects
  FOR UPDATE TO anon, authenticated USING (bucket_id = 'images');

-- Allow anon/authenticated to delete
CREATE POLICY "anon_delete_images" ON storage.objects
  FOR DELETE TO anon, authenticated USING (bucket_id = 'images');
