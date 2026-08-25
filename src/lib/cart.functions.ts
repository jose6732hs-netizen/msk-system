import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadCart } = await import("./cart.server");
    return loadCart(context.userId);
  });

export const addCartItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        quantity: z.number().int().min(1).max(20).optional(),
        affiliateCode: z.string().max(24).optional(),
        resellerCode: z.string().max(24).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { addToCart } = await import("./cart.server");
    return addToCart({
      userId: context.userId,
      planId: data.planId,
      quantity: data.quantity ?? 1,
      affiliateCode: data.affiliateCode ?? null,
      resellerCode: data.resellerCode ?? null,
    });
  });

export const updateCartItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ itemId: z.string().uuid(), quantity: z.number().int().min(0).max(20) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { setCartQuantity } = await import("./cart.server");
    return setCartQuantity(context.userId, data.itemId, data.quantity);
  });

export const removeCartItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { removeFromCart } = await import("./cart.server");
    return removeFromCart(context.userId, data.itemId);
  });

export const clearCartItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { clearCart } = await import("./cart.server");
    return clearCart(context.userId);
  });

/** Lista de pedidos reais do usuário (com expiração de PIX aplicada no backend). */
export const listMyOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listOrders } = await import("./orders.server");
    return { orders: await listOrders(context.userId) };
  });
