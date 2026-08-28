/** Traqueamento local (client-side) de páginas, ofertas, produtos e carrinhos abandonados. */
import { normalizeProductImage } from "./product-image";

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

/** Snapshot do carrinho para detectar abandono e manter o indicador global sincronizado. */
export type AbandonedCartItem = {
  /** Plano correspondente — permite ir direto para o pagamento pelo carrinho. */
  planId?: string | null;
  slug?: string | null;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string | null;
};

export type AbandonedCart = {
  updatedAt: string;
  total: number;
  items: AbandonedCartItem[];
};

function stabilizeCart(cart: AbandonedCart | null) {
  if (!cart) return null;
  return {
    ...cart,
    items: cart.items.map((item) => ({
      ...item,
      imageUrl: normalizeProductImage(item.imageUrl, item.slug ?? item.name),
    })),
  } satisfies AbandonedCart;
}

function cartCount(cart: AbandonedCart | null) {
  return (cart?.items ?? []).reduce((sum, item) => sum + Math.max(0, Number(item.quantity ?? 0)), 0);
}

export function saveCartSnapshot(cart: AbandonedCart | null) {
  if (!isBrowser()) return;
  const previous = readCartSnapshot();
  const stableCart = stabilizeCart(cart);
  const previousCount = cartCount(previous);
  const nextCount = cartCount(stableCart);

  if (!stableCart || stableCart.items.length === 0) {
    localStorage.removeItem(CART_KEY);
  } else {
    localStorage.setItem(CART_KEY, JSON.stringify(stableCart));
  }

  const addedItem =
    nextCount > previousCount
      ? stableCart?.items.find((item) => {
          const before = previous?.items.find((old) => old.name === item.name)?.quantity ?? 0;
          return Number(item.quantity ?? 0) > Number(before);
        }) ?? stableCart?.items.at(-1) ?? null
      : null;

  window.dispatchEvent(new CustomEvent("msk:track"));
  window.dispatchEvent(
    new CustomEvent("msk:cart-change", {
      detail: {
        cart: stableCart,
        count: nextCount,
        previousCount,
        added: nextCount > previousCount,
        addedItem,
      },
    }),
  );
}

export function readCartSnapshot(): AbandonedCart | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AbandonedCart;
    return stabilizeCart(parsed);
  } catch {
    return null;
  }
}
