DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
CREATE POLICY "Avatars read by direct path" ON storage.objects FOR SELECT USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Avatars anon read by path" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'avatars' AND name IS NOT NULL);