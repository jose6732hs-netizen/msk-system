import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    __mskPasswordRecoveryListener?: boolean;
  }
}

if (typeof window !== "undefined" && !window.__mskPasswordRecoveryListener) {
  window.__mskPasswordRecoveryListener = true;

  supabase.auth.onAuthStateChange((event) => {
    if (event !== "PASSWORD_RECOVERY") return;

    const targetPath = "/auth?mode=new-password";
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (currentPath !== targetPath) {
      window.location.replace(targetPath);
    }
  });
}
