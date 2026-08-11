
-- Resolver avisos de segurança: remover privilégios públicos de execução de funções sensíveis
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_affiliate_wallet_on_affiliate_creation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_affiliate_wallet_on_affiliate_creation() TO authenticated, service_role;
