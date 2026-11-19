DROP POLICY IF EXISTS "property images public read" ON storage.objects;
CREATE POLICY "property images read current photos" ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'property-images' AND (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.residences r WHERE r.active AND r.image_path = storage.objects.name)
  )
);