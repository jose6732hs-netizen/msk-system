import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    __mskPasswordRecoveryListener?: boolean;
  }
}

const RECOVERY_PATH = "/auth?mode=new-password";

function goToRecovery(target: string) {
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current !== target) {
    window.location.replace(target);
  }
}

if (typeof window !== "undefined" && !window.__mskPasswordRecoveryListener) {
  window.__mskPasswordRecoveryListener = true;

  // 1) Fluxo implicit: tokens chegam no hash (#access_token=...&type=recovery).
  //    Redireciona preservando o hash para o supabase-js processar a sessão.
  const hash = window.location.hash;
  if (hash.includes("type=recovery")) {
    goToRecovery(`${RECOVERY_PATH}${hash}`);
  }

  // 2) Fluxo PKCE: chega ?code=... na URL. Marca de que é recuperação vem do
  //    localStorage (gravada ao solicitar o reset) ou o evento trata abaixo.
  supabase.auth.onAuthStateChange((event) => {
    if (event !== "PASSWORD_RECOVERY") return;
    goToRecovery(RECOVERY_PATH);
  });
}
