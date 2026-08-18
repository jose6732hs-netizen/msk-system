import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { track } from "@/lib/tracking";
import { initMetaPixel, pixelTrack, pixelTrackCustom } from "@/lib/meta-pixel";

/** Traqueamento de PageView + helper de eventos para o SaaS (interno + Meta Pixel). */
export function useTracking() {
  const location = useLocation();

  useEffect(() => {
    initMetaPixel();
  }, []);

  useEffect(() => {
    track("pageview", { path: location.pathname });
    pixelTrack("PageView");
  }, [location.pathname]);

  return {
    trackEvent: (name: string, properties?: Record<string, unknown>) => {
      track("pageview", properties ? { path: name, meta: properties } : { path: name });
      pixelTrackCustom(name, properties);
    },
  };
}
