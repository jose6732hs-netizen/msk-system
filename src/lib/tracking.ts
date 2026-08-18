/** Traqueamento local (client-side) de páginas, ofertas, produtos e carrinhos abandonados. */
export type TrackEvent = {
  id: string;
  type:
    | "pageview"
    | "offer_view"
    | "add_to_cart"
    | "remove_from_cart"
    | "checkout_start"
    | "pix_generated"
    | "purchase"
    | "cart_abandoned";
  path?: string;
  label?: string;
  value?: number;
  meta?: Record<string, unknown>;
  at: string;
};

const KEY = "msk_tracking_events";
const CART_KEY = "msk_tracking_cart";
const MAX = 800;

function isBrowser() {
  return typeof window !== "undefined";
}

export function readEvents(): TrackEvent[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as TrackEvent[];
  } catch {
    return [];
  }
}

/** Mapeamento dos eventos internos para eventos padrão do Meta Pixel. */
const PIXEL_MAP: Record<TrackEvent["type"], string | null> = {
  pageview: null, // já disparado pelo hook de rota
  offer_view: "ViewContent",
  add_to_cart: "AddToCart",
  remove_from_cart: null,
  checkout_start: "InitiateCheckout",
  pix_generated: "AddPaymentInfo",
  purchase: "Purchase",
  cart_abandoned: null,
};

export function track(type: TrackEvent["type"], data: Partial<TrackEvent> = {}) {
  if (!isBrowser()) return;
  const pixelEvent = PIXEL_MAP[type];
  if (pixelEvent) {
    void import("./meta-pixel").then(({ pixelTrack }) =>
      pixelTrack(pixelEvent, {
        content_name: data.label ?? data.path ?? type,
        value: Number(data.value ?? 0),
        currency: "BRL",
      }),
    );
  }
  const evt: TrackEvent = {
    id: crypto.randomUUID(),
    type,
    at: new Date().toISOString(),
    ...data,
  };
  const list = [evt, ...readEvents()].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("msk:track", { detail: evt }));
}

export function clearEvents() {
  if (!isBrowser()) return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("msk:track"));
}

/** Snapshot do carrinho para detectar abandono. */
export type AbandonedCart = {
  updatedAt: string;
  total: number;
  items: { name: string; quantity: number; price: number; imageUrl?: string | null }[];
};

export function saveCartSnapshot(cart: AbandonedCart | null) {
  if (!isBrowser()) return;
  if (!cart || cart.items.length === 0) {
    localStorage.removeItem(CART_KEY);
  } else {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }
  window.dispatchEvent(new CustomEvent("msk:track"));
}

export function readCartSnapshot(): AbandonedCart | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as AbandonedCart) : null;
  } catch {
    return null;
  }
}
