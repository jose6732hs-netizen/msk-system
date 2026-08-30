import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { findLicenseByToken, jsonResponse, preflight } from "@/lib/license.server";
import { handleValidation } from "@/lib/license-validate.server";

export const MSK_LIVE_PRODUCT_SLUG = "msk-live";

function browserExtensionOrigin(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://")) {
    return origin;
  }
  return null;
}

export function mskLivePreflight(request: Request) {
  const origin = browserExtensionOrigin(request);
  if (!origin) return preflight(request);
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "content-type, authorization",
      "access-control-allow-methods": "POST, GET, OPTIONS",
      "access-control-max-age": "86400",
      vary: "Origin",
    },
  });
}

export function withMskLiveCors(response: Response, request: Request) {
  const origin = browserExtensionOrigin(request);
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-headers", "content-type, authorization");
  headers.set("access-control-allow-methods", "POST, GET, OPTIONS");
  headers.set("vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function fixedProductRequest(request: Request, body: Record<string, unknown>) {
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");
  return new Request(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, product: MSK_LIVE_PRODUCT_SLUG }),
  });
}

function blocked(request: Request, code: "PRODUCT_INACTIVE" | "PLAN_INACTIVE", message: string) {
  return jsonResponse(
    {
      success: false,
      valid: false,
      status: "BLOCKED",
      action: "REAUTH_REQUIRED",
      error: code,
      code,
      message,
      product_slug: MSK_LIVE_PRODUCT_SLUG,
      timestamp: Date.now(),
    },
    403,
    request,
  );
}

/**
 * Validação exclusiva do MSK LIVE.
 * O produto é fixado no servidor e, depois da autenticação da licença,
 * produto + plano + oferta precisam continuar ativos no SaaS.
 */
export async function handleMskLiveLicenseValidation(
  request: Request,
  bucket: string,
  limit: number,
) {
  const body = (await request.clone().json().catch(() => ({}))) as Record<string, unknown>;
  const fixedRequest = fixedProductRequest(request, body);
  const response = await handleValidation(fixedRequest, bucket, limit, "extension");

  const payload = (await response.clone().json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || payload?.["valid"] !== true) return response;

  const token = String(body["token"] ?? "").trim();
  if (!token) return response;
  const license = (await findLicenseByToken(token)) as any;
  if (!license?.plan_id) return response;

  const { data: product } = await supabaseAdmin
    .from("products")
    .select("id,active")
    .eq("slug", MSK_LIVE_PRODUCT_SLUG)
    .maybeSingle();
  if (!product || (product as any).active === false) {
    return blocked(fixedRequest, "PRODUCT_INACTIVE", "O MSK LIVE está temporariamente desativado no MSK SYSTEM.");
  }

  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("id,active")
    .eq("id", String(license.plan_id))
    .maybeSingle();
  if (!plan || (plan as any).active !== true) {
    return blocked(fixedRequest, "PLAN_INACTIVE", "Seu plano MSK LIVE está desativado. Renove ou escolha uma nova licença.");
  }

  const { data: offer } = await supabaseAdmin
    .from("offers")
    .select("id")
    .eq("product_id", String((product as any).id))
    .eq("plan_id", String(license.plan_id))
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (!offer) {
    return blocked(fixedRequest, "PLAN_INACTIVE", "Esta oferta do MSK LIVE não está ativa. Renove ou escolha outra oferta.");
  }

  return response;
}
