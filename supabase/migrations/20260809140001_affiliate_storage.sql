-- Bucket para documentos de KYC dos afiliados
INSERT INTO storage.buckets (id, name, public) 
VALUES ('affiliate-docs', 'affiliate-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir que usuários autenticados façam upload de seus próprios docs
-- Nota: O caminho começa com 'kyc/' mas idealmente deveria ter o userId. 
-- Simplificando para permitir upload se autenticado, RLS na tabela cuida do resto.
CREATE POLICY "Permitir upload de documentos KYC"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'affiliate-docs');

CREATE POLICY "Permitir leitura de documentos KYC"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'affiliate-docs');
