import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const email = (claims: Record<string, unknown>) => (claims["email"] as string) ?? "";
const name = (claims: Record<string, unknown>) =>
  ((claims["user_metadata"] as Record<string, unknown> | undefined)?.["name"] as string) ?? "";

export const startPixCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid().optional(),
        // Checkout em lote enviado pelo carrinho do navegador.
        items: z
          .array(z.object({ planId: z.string().uuid(), quantity: z.number().int().min(1).max(20) }))
          .max(20)
          .optional(),
        affiliateCode: z.string().max(24).optional(),
        resellerCode: z.string().max(24).optional(),
        document: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length === 11 || v.length === 14, "CPF/CNPJ inválido"),
        phone: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length >= 10 && v.length <= 13, "Telefone inválido"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { createPixCheckout } = await import("./checkout.server");
    return createPixCheckout({
      userId: context.userId,
      email: email(context.claims),
      name: name(context.claims),
      planId: data.planId ?? null,
      items: data.items ?? null,
      affiliateCode: data.affiliateCode ?? null,
      resellerCode: data.resellerCode ?? null,
      document: data.document,
      phone: data.phone,
    });
  });

export const checkTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { getTransactionStatus } = await import("./checkout.server");
    return getTransactionStatus(context.userId, data.transactionId);
  });

export const requestTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ planId: z.string().uuid().optional(), resellerCode: z.string().max(24).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { grantTrial, findResellerByCode } = await import("./commerce.server");
    const reseller = await findResellerByCode(data.resellerCode ?? null);
    const result = await grantTrial({
      userId: context.userId,
      planId: data.planId ?? null,
      resellerId: reseller?.id ?? null,
    });
    return { token: result.token };
  });

export const getAffiliateDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadAffiliateDashboard } = await import("./partners.server");
    return loadAffiliateDashboard(context.userId);
  });

export const joinAffiliate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureAffiliate } = await import("./commerce.server");
    const affiliate = await ensureAffiliate(context.userId);
    return { code: affiliate.code };
  });

export const getResellerDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadResellerDashboard } = await import("./partners.server");
    return loadResellerDashboard(context.userId);
  });

export const joinReseller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureReseller } = await import("./commerce.server");
    const reseller = await ensureReseller(context.userId);
    return { code: reseller.code };
  });

export const startDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ amount: z.number().min(10).max(100000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { createDepositCheckout } = await import("./checkout.server");
    return createDepositCheckout({
      userId: context.userId,
      email: email(context.claims),
      name: name(context.claims),
      amount: data.amount,
    });
  });

export const createWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        amount: z.number().min(10),
        pixKey: z.string().min(3).max(140),
        pixKeyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"]),
        origin: z.enum(["affiliate", "reseller"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requestWithdrawal } = await import("./checkout.server");
    return requestWithdrawal({ userId: context.userId, ...data });
  });

export const saveBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        extensionName: z.string().min(2).max(60),
        description: z.string().max(200),
        primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        titleColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        supportUrl: z.string().url().optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { saveResellerBranding } = await import("./partners.server");
    return saveResellerBranding(context.userId, data);
  });
export const startSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        method: z.enum(["PIX", "CARD"]),
        affiliateCode: z.string().max(24).optional(),
        resellerCode: z.string().max(24).optional(),
        document: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length === 11 || v.length === 14, "CPF/CNPJ inválido"),
        phone: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length >= 10 && v.length <= 13, "Telefone inválido"),
        card: z
          .object({
            number: z.string().min(12).max(19),
            holderName: z.string().min(2).max(80),
            expiresAt: z.string().min(4).max(7),
            cvv: z.string().min(3).max(4),
            installments: z.number().int().min(1).max(12).optional(),
          })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { createSubscriptionCheckout } = await import("./checkout.server");
    return createSubscriptionCheckout({
      userId: context.userId,
      email: email(context.claims),
      name: name(context.claims),
      planId: data.planId,
      method: data.method,
      card: data.card,
      affiliateCode: data.affiliateCode ?? null,
      resellerCode: data.resellerCode ?? null,
      document: data.document,
      phone: data.phone,
    });
  });

export const getResellerPricing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listResellerPricing, listTiers } = await import("./reseller.server");
    const { ensureReseller } = await import("./commerce.server");
    const reseller = await ensureReseller(context.userId);
    return {
      tier: reseller.tier,
      prices: await listResellerPricing(reseller.tier),
      tiers: await listTiers(),
    };
  });

export const sellLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        priceId: z.string().uuid(),
        customerName: z.string().min(2).max(80),
        customerEmail: z.string().email(),
        salePrice: z.number().min(0).max(100000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { purchaseLicenseAsReseller } = await import("./reseller.server");
    return purchaseLicenseAsReseller({
      userId: context.userId,
      priceId: data.priceId,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      salePrice: data.salePrice ?? null,
    });
  });

export const getLicenseForTransaction = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Validar que a transação pertence ao usuário e está paga
    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .select("id,status,user_id")
      .eq("id", data.transactionId)
      .eq("user_id", context.userId)
      .maybeSingle();
      
    if (!tx) throw new Error("Transação não encontrada.");
    if (tx.status !== "PAID") throw new Error("Pagamento ainda não confirmado.");

    const { data: license } = await supabaseAdmin
      .from("licenses")
      .select(`
        *,
        plans:plan_id (
          id,
          name,
          slug,
          features,
          is_lifetime
        )
      `)
      .eq("transaction_id", tx.id)
      .maybeSingle();
      
    if (!license) throw new Error("Licença ainda não gerada. Tente novamente em alguns segundos.");

    return license;
  });
