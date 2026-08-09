import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { track } from "@/lib/tracking";

/** Traqueamento de PageView + helper de eventos para o SaaS. */
export function useTracking() {
  const location = useLocation();

  useEffect(() => {
    track("pageview", { path: location.pathname });
  }, [location.pathname]);

  return {
    trackEvent: (name: string, properties?: Record<string, unknown>) =>
      track("pageview", properties ? { path: name, meta: properties } : { path: name }),
  };

}
