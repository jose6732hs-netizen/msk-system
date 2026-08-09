-- Políticas de storage
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Permitir upload de documentos KYC'
    ) THEN
        CREATE POLICY "Permitir upload de documentos KYC"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'affiliate-docs');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Permitir leitura de documentos KYC'
    ) THEN
        CREATE POLICY "Permitir leitura de documentos KYC"
        ON storage.objects FOR SELECT TO authenticated
        USING (bucket_id = 'affiliate-docs');
    END IF;
END $$;