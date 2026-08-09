-- Atualiza as taxas de comissão para os novos valores profissionais (60% a 80%)
UPDATE public.affiliate_tiers 
SET commission_rate = CASE 
    WHEN name = 'Bronze' THEN 60.00
    WHEN name = 'Prata' THEN 65.00
    WHEN name = 'Ouro' THEN 70.00
    WHEN name = 'Diamante' THEN 80.00
    ELSE commission_rate
END;

-- Atualiza a configuração global de comissão
UPDATE public.app_settings 
SET value = jsonb_set(value, '{affiliate}', '60')
WHERE key = 'commissions';

-- Garante que afiliados existentes sem taxa personalizada sejam atualizados para a nova taxa base
UPDATE public.affiliates
SET commission_rate = 60.00
WHERE commission_rate = 30.00;
