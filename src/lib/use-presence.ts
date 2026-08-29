import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "msk_presence_session_id";
const COUNT_KEY = "msk_last_online_count";
const HEARTBEAT_MS = 30_000;

function sessionId(): string {
  if (typeof window === "undefined") return "";
  let id = "";
  try {
    id = localStorage.getItem(SESSION_KEY) ?? "";
  } catch {
    /* storage bloqueado */
  }
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    try {
      localStorage.setItem(SESSION_KEY, id);
    } catch {
      /* storage bloqueado */
    }
  }
  return id;
}

function cachedCount(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = Number(localStorage.getItem(COUNT_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Presença real via Supabase: heartbeat de 30s na mesma sessão do navegador,
 * contagem por sessões ativas nos últimos 2 minutos e atualização por Realtime.
 * Nunca zera: mantém o último valor válido conhecido.
 */
export function usePresence() {
  const [online, setOnline] = useState<number | null>(() => cachedCount());
  const lastValid = useRef<number | null>(cachedCount());

  useEffect(() => {
    let alive = true;

    const publish = (value: number | null | undefined) => {
      const n = Number(value);
      if (!alive || !Number.isFinite(n) || n <= 0) return;
      lastValid.current = n;
      setOnline(n);
      try {
        localStorage.setItem(COUNT_KEY, String(n));
      } catch {
        /* storage bloqueado */
      }
    };

    const id = sessionId();

    const heartbeat = async () => {
      if (document.visibilityState === "hidden") return;
      const { data: auth } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }) as never);
      const { data } = await supabase.rpc("presence_heartbeat" as never, {
        _session_id: id,
        _user_id: auth?.user?.id ?? null,
      } as never);
      publish(data as unknown as number);
    };

    const refresh = async () => {
      const { data } = await supabase.rpc("presence_online_count" as never);
      publish(data as unknown as number);
    };

    void heartbeat();
    const beat = setInterval(() => void heartbeat(), HEARTBEAT_MS);

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void refresh();
      }, 1500);
    };

    const channel = supabase
      .channel("presence-sessions-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "presence_sessions" }, scheduleRefresh)
      .subscribe();

    // Expira quem saiu: revalida periodicamente mesmo sem eventos.
    const sweep = setInterval(() => void refresh(), 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void heartbeat();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      clearInterval(beat);
      clearInterval(sweep);
      if (refreshTimer) clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, []);

  return online ?? lastValid.current;
}
