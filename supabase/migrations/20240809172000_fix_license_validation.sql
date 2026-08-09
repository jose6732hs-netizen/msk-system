-- Garante que o status 'inactive' (nunca usado) seja tratado corretamente
-- na função de validação se houver lógica de DB específica, mas aqui
-- focaremos em garantir que o registro inicial do dispositivo não falhe.

-- Adiciona a coluna 'last_ip_hash' se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'license_devices' AND COLUMN_NAME = 'last_ip_hash') THEN
        ALTER TABLE public.license_devices ADD COLUMN last_ip_hash text;
    END IF;
END $$;

-- Garante que o gatilho de ativação automática de licenças novas funcione
CREATE OR REPLACE FUNCTION public.handle_new_device_activation()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a licença está 'inactive' (nova), ativa ela no primeiro dispositivo
  UPDATE public.licenses
  SET status = 'active', 
      activated_at = COALESCE(activated_at, now())
  WHERE id = NEW.license_id 
    AND status = 'inactive';
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_new_device_activation ON public.license_devices;
CREATE TRIGGER tr_new_device_activation
AFTER INSERT ON public.license_devices
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_device_activation();

GRANT ALL ON public.license_devices TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.license_devices TO authenticated;
