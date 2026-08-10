
  -- Desativa qualquer build anterior no canal principal
  UPDATE public.extension_builds 
  SET is_published = false 
  WHERE channel_slug = 'm3k-principal';

  -- Insere o novo build v35.1.0 e o torna o ativo
  INSERT INTO public.extension_builds (
    channel_slug,
    version,
    file_name,
    storage_path,
    size_bytes,
    status,
    is_official,
    is_published,
    release_notes
  ) VALUES (
    'm3k-principal',
    '35.1.0',
    'msk_sistem_licenciada_v35.zip',
    'official/35.1.0/msk_sistem_licenciada_v35.zip',
    570368,
    'ready',
    true,
    true,
    'Atualização v35.1.0: Modo MSK Ativado no Chat Lovable e Créditos Infinitos com neon rosa.'
  );

  -- Sincroniza o canal principal usando sintaxe correta para JSONB
  UPDATE public.extension_channels
  SET 
    version = '35.1.0',
    enabled = true,
    active = true,
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb), 
      '{public_zip}', 
      '"/official/35.1.0/msk_sistem_licenciada_v35.zip"'::jsonb
    )
  WHERE slug = 'm3k-principal';
