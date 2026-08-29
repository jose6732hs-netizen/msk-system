import { usePresence } from "@/lib/use-presence";

/** Registra a presença real do visitante (sem UI). */
export function PresenceTracker() {
  usePresence();
  return null;
}

export default PresenceTracker;
