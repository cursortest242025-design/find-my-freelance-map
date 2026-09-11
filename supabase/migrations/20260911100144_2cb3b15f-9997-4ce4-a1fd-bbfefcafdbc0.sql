CREATE POLICY "Public can read freelancer media"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'freelancer-media');

CREATE POLICY "Users can upload own freelancer media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'freelancer-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
);

CREATE POLICY "Users can update own freelancer media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'freelancer-media' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (
  bucket_id = 'freelancer-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
);

CREATE POLICY "Users can delete own freelancer media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'freelancer-media' AND (storage.foldername(name))[1] = auth.uid()::text);