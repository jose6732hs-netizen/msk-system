import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { absoluteUrl, getAppUrl } from "./app-url.server";
import { decryptToken } from "./license.server";

const RESEND_EMAIL_URL = "https://api.resend.com/emails";
const EXTENSION_BUCKET = "extension-builds";
const PURCHASE_ZIP_TTL_SECONDS = 60 * 60;

function env(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function emailConfig() {
  return {
    apiKey: env("RESEND_API_KEY"),
    fromEmail: env("MSK_EMAIL_FROM", "RESEND_FROM_EMAIL", "EMAIL_FROM"),
  };
}

function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value: unknown) {
  if (!value) return "Sem expiração definida";
  try {
    return new Date(String(value)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return String(value);
  }
}

function shell(content: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#050806;font-family:Arial,Helvetica,sans-serif;color:#f4fff5"><div style="padding:32px 14px"><div style="max-width:640px;margin:0 auto;border:1px solid #39ff1455;border-radius:24px;overflow:hidden;background:#07110a;box-shadow:0 0 36px #39ff141f"><div style="height:4px;background:#39ff14"></div>${content}<div style="padding:0 28px 28px;color:#718476;font-size:11px;line-height:1.55">Mensagem operacional enviada pela plataforma MSK SISTEM.</div></div></div></body></html>`;
}

async function sendTransactionalEmail(input: {
  eventKey: string;
  kind: string;
  userId?: string | null;
  email: string;
  subject: string;
  html: string;
  text: string;
  metadata?: Record<string, unknown>;
}) {
  const config = emailConfig();
  if (!config.apiKey || !config.fromEmail) {
    throw new Error("E-mail transacional aguardando RESEND_API_KEY e MSK_EMAIL_FROM.");
  }

  const email = normalizeEmail(input.email);
  if (!email) throw new Error("Destinatário sem e-mail válido.");

  const db = supabaseAdmin as any;
  const existing = await db
    .from("transactional_email_deliveries")
    .select("id,status,provider_message_id")
    .eq("event_key", input.eventKey)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.status === "sent") {
    return { ok: true, alreadySent: true, id: existing.data.id, providerMessageId: existing.data.provider_message_id };
  }

  let deliveryId = existing.data?.id as string | undefined;
  if (!deliveryId) {
    const created = await db
      .from("transactional_email_deliveries")
      .insert({
        event_key: input.eventKey,
        kind: input.kind,
        user_id: input.userId ?? null,
        email,
        subject: input.subject,
        status: "pending",
        metadata: input.metadata ?? {},
      })
      .select("id,status,provider_message_id")
      .single();
    if (created.error) {
      const raced = await db
        .from("transactional_email_deliveries")
        .select("id,status,provider_message_id")
        .eq("event_key", input.eventKey)
        .single();
      if (raced.error) throw created.error;
      if (raced.data.status === "sent") {
        return { ok: true, alreadySent: true, id: raced.data.id, providerMessageId: raced.data.provider_message_id };
      }
      deliveryId = raced.data.id;
    } else {
      deliveryId = created.data.id;
    }
  }

  await db
    .from("transactional_email_deliveries")
    .update({ status: "sending", error: null, updated_at: new Date().toISOString() })
    .eq("id", deliveryId);

  try {
    const response = await fetch(RESEND_EMAIL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.eventKey.slice(0, 256),
      },
      body: JSON.stringify({
        from: config.fromEmail,
        to: [email],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(body?.message || body?.name || `Resend HTTP ${response.status}`));
    }

    const sentAt = new Date().toISOString();
    await db
      .from("transactional_email_deliveries")
      .update({
        status: "sent",
        provider_message_id: body?.id ?? null,
        error: null,
        sent_at: sentAt,
        updated_at: sentAt,
      })
      .eq("id", deliveryId);

    return { ok: true, alreadySent: false, id: deliveryId, providerMessageId: body?.id ?? null };
  } catch (error) {
    await db
      .from("transactional_email_deliveries")
      .update({
        status: "failed",
        error: (error as Error).message.slice(0, 800),
        updated_at: new Date().toISOString(),
      })
      .eq("id", deliveryId);
    throw error;
  }
}

async function createPurchaseZipLink() {
  const db = supabaseAdmin as any;
  const channelResult = await db
    .from("extension_channels")
    .select("slug,display_name,enabled,active,channel_number")
    .order("channel_number", { ascending: true });
  if (channelResult.error) throw channelResult.error;

  const channels = (channelResult.data ?? []).filter((row: any) => row.enabled !== false && row.active !== false);
  const channel = channels.find((row: any) => row.slug === "m3k-principal") ?? channels[0] ?? null;

  let query = db
    .from("extension_builds")
    .select("id,version,file_name,storage_path,channel_slug")
    .eq("is_published", true)
    .eq("is_official", true)
    .order("created_at", { ascending: false })
    .limit(1);
  if (channel?.slug) query = query.eq("channel_slug", channel.slug);

  let buildResult = await query.maybeSingle();
  if (!buildResult.data && channel?.slug) {
    buildResult = await db
      .from("extension_builds")
      .select("id,version,file_name,storage_path,channel_slug")
      .eq("is_published", true)
      .eq("is_official", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  }
  if (buildResult.error) throw buildResult.error;
  const build = buildResult.data;
  if (!build?.storage_path) return null;

  const signed = await supabaseAdmin.storage
    .from(EXTENSION_BUCKET)
    .createSignedUrl(build.storage_path, PURCHASE_ZIP_TTL_SECONDS, { download: build.file_name });
  if (signed.error) throw signed.error;
  return {
    url: signed.data.signedUrl,
    fileName: build.file_name,
    version: build.version,
    expiresInSeconds: PURCHASE_ZIP_TTL_SECONDS,
  };
}

export async function sendAffiliateApprovedEmail(affiliateId: string) {
  const db = supabaseAdmin as any;
  const affiliateResult = await db
    .from("affiliates")
    .select("id,user_id,code,verification_status,status")
    .eq("id", affiliateId)
    .maybeSingle();
  if (affiliateResult.error) throw affiliateResult.error;
  const affiliate = affiliateResult.data;
  if (!affiliate?.user_id || affiliate.verification_status !== "APPROVED") return { ok: false, skipped: true };

  const profileResult = await db
    .from("profiles")
    .select("id,name,email")
    .eq("id", affiliate.user_id)
    .maybeSingle();
  if (profileResult.error) throw profileResult.error;
  const profile = profileResult.data;
  const email = normalizeEmail(profile?.email);
  if (!email) return { ok: false, skipped: true };

  const panelUrl = await absoluteUrl("/parceiro/");
  const name = escapeHtml(profile?.name || "Parceiro");
  const code = escapeHtml(affiliate.code || "");
  const subject = "Você foi aprovado como afiliado — MSK SISTEM";
  const html = shell(`
    <div style="padding:28px">
      <div style="display:inline-block;padding:7px 12px;border:1px solid #39ff1466;border-radius:999px;color:#7cff67;font-size:11px;font-weight:800;letter-spacing:1.4px">AFILIADO APROVADO</div>
      <h1 style="margin:18px 0 10px;font-size:30px;line-height:1.05;color:#fff">Parabéns, ${name}. Seu acesso foi aprovado.</h1>
      <p style="margin:0;color:#c9d8cc;font-size:15px;line-height:1.65">Seu cadastro de afiliado MSK SISTEM foi aprovado. Seu painel já está liberado para acompanhar indicações, vendas, comissões e carteira.</p>
      ${code ? `<div style="margin:22px 0;padding:18px;border-radius:16px;background:#0b1d10;border:1px solid #39ff143d"><div style="font-size:11px;color:#8fa493;text-transform:uppercase;letter-spacing:1.2px;font-weight:700">Seu código de afiliado</div><div style="margin-top:6px;color:#7cff67;font-size:23px;font-weight:900;letter-spacing:1px">${code}</div></div>` : ""}
      <a href="${escapeHtml(panelUrl)}" style="display:inline-block;background:#39ff14;color:#041006;text-decoration:none;font-weight:900;padding:14px 22px;border-radius:12px">ENTRAR NO PAINEL DE AFILIADO</a>
    </div>`);
  const text = [`AFILIADO APROVADO — MSK SISTEM`, ``, `Olá, ${profile?.name || "Parceiro"}. Seu cadastro foi aprovado.`, code ? `Seu código: ${affiliate.code}` : "", `Acesse seu painel: ${panelUrl}`].filter(Boolean).join("\n");

  return sendTransactionalEmail({
    eventKey: `affiliate-approved:${affiliateId}`,
    kind: "affiliate_approved",
    userId: affiliate.user_id,
    email,
    subject,
    html,
    text,
    metadata: { affiliateId, code: affiliate.code ?? null, panelUrl },
  });
}

export async function sendPurchaseApprovedEmail(transactionId: string) {
  const db = supabaseAdmin as any;
  const txResult = await db
    .from("transactions")
    .select("id,user_id,amount,identifier,status,paid_at")
    .eq("id", transactionId)
    .maybeSingle();
  if (txResult.error) throw txResult.error;
  const tx = txResult.data;
  if (!tx?.user_id) return { ok: false, skipped: true };

  const [profileResult, licensesResult] = await Promise.all([
    db.from("profiles").select("id,name,email").eq("id", tx.user_id).maybeSingle(),
    db
      .from("licenses")
      .select("id,token_encrypted,status,expires_at,metadata,plans(name,slug)")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: true }),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (licensesResult.error) throw licensesResult.error;
  const profile = profileResult.data;
  const email = normalizeEmail(profile?.email);
  const licenses = licensesResult.data ?? [];
  if (!email || !licenses.length) return { ok: false, skipped: true };

  const renderedLicenses: Array<{ id: string; token: string; label: string; purpose: string; expires: string; role: string }> = [];
  for (const license of licenses) {
    const token = license.token_encrypted ? await decryptToken(String(license.token_encrypted)) : null;
    const metadata = (license.metadata ?? {}) as Record<string, unknown>;
    renderedLicenses.push({
      id: String(license.id),
      token: token || "Consulte no seu painel",
      label: String(metadata["item_label"] ?? license.plans?.name ?? "Licença MSK"),
      purpose: String(metadata["license_purpose"] ?? "Acesso MSK SISTEM"),
      expires: formatDate(license.expires_at),
      role: String(metadata["license_role"] ?? ""),
    });
  }

  const includesExtension = renderedLicenses.some((license) => license.role === "extension");
  let zip: Awaited<ReturnType<typeof createPurchaseZipLink>> = null;
  if (includesExtension) {
    try {
      zip = await createPurchaseZipLink();
    } catch (error) {
      console.error("[email] falha ao gerar ZIP temporário da compra:", error);
    }
  }

  const base = await getAppUrl();
  if (!base) throw new Error("APP_URL/domínio da plataforma não configurado para montar os links do e-mail.");
  const thanksUrl = await absoluteUrl(`/obrigado?transactionId=${encodeURIComponent(transactionId)}`);
  const panelUrl = await absoluteUrl("/painel");
  const subject = "Pagamento aprovado — sua licença MSK SISTEM está liberada";
  const licenseCards = renderedLicenses.map((license, index) => `
    <div style="margin-top:14px;padding:18px;border-radius:16px;background:#0b1d10;border:1px solid #39ff143d">
      <div style="font-size:10px;color:#7cff67;text-transform:uppercase;letter-spacing:1.2px;font-weight:900">LICENÇA ${index + 1}</div>
      <div style="margin-top:7px;color:#fff;font-size:17px;font-weight:900">${escapeHtml(license.label)}</div>
      <div style="margin-top:4px;color:#8fa493;font-size:12px">${escapeHtml(license.purpose)} · ${escapeHtml(license.expires)}</div>
      <div style="margin-top:14px;padding:14px;border-radius:12px;background:#020704;border:1px solid #39ff1450;color:#7cff67;font-family:monospace;font-size:16px;font-weight:900;word-break:break-all;letter-spacing:.5px">${escapeHtml(license.token)}</div>
    </div>`).join("");

  const zipBlock = zip
    ? `<div style="margin-top:22px;padding:18px;border-radius:16px;background:#07150b;border:1px solid #39ff1440"><div style="font-size:12px;color:#fff;font-weight:900">Download temporário da extensão</div><div style="margin:5px 0 14px;color:#8fa493;font-size:12px">Este link expira em 1 hora por segurança.</div><a href="${escapeHtml(zip.url)}" style="display:inline-block;background:#39ff14;color:#041006;text-decoration:none;font-weight:900;padding:13px 19px;border-radius:11px">BAIXAR ZIP AGORA</a></div>`
    : "";

  const html = shell(`
    <div style="padding:28px">
      <div style="display:inline-block;padding:7px 12px;border:1px solid #39ff1466;border-radius:999px;color:#7cff67;font-size:11px;font-weight:800;letter-spacing:1.4px">PAGAMENTO APROVADO</div>
      <h1 style="margin:18px 0 10px;font-size:30px;line-height:1.05;color:#fff">Sua compra foi aprovada e sua licença já está liberada.</h1>
      <p style="margin:0;color:#c9d8cc;font-size:15px;line-height:1.65">Olá, ${escapeHtml(profile?.name || "cliente")}. A confirmação foi recebida e a entrega automática foi concluída.</p>
      ${licenseCards}
      ${zipBlock}
      <div style="margin-top:22px;display:block">
        <a href="${escapeHtml(thanksUrl)}" style="display:inline-block;background:#39ff14;color:#041006;text-decoration:none;font-weight:900;padding:14px 22px;border-radius:12px;margin-right:8px">VER COMPRA APROVADA</a>
        <a href="${escapeHtml(panelUrl)}" style="display:inline-block;color:#7cff67;text-decoration:none;font-weight:800;padding:13px 6px">IR PARA O PAINEL</a>
      </div>
    </div>`);

  const text = [
    "PAGAMENTO APROVADO — MSK SISTEM",
    "",
    `Olá, ${profile?.name || "cliente"}. Sua compra foi aprovada e sua licença está liberada.`,
    ...renderedLicenses.flatMap((license, index) => [
      `Licença ${index + 1}: ${license.label}`,
      `Token: ${license.token}`,
      `Validade: ${license.expires}`,
      "",
    ]),
    zip ? `Download temporário do ZIP (válido por 1 hora): ${zip.url}` : "",
    `Compra aprovada: ${thanksUrl}`,
    `Painel: ${panelUrl}`,
  ].filter(Boolean).join("\n");

  return sendTransactionalEmail({
    eventKey: `purchase-approved:${transactionId}`,
    kind: "purchase_approved",
    userId: tx.user_id,
    email,
    subject,
    html,
    text,
    metadata: {
      transactionId,
      licenseIds: renderedLicenses.map((license) => license.id),
      zipIncluded: !!zip,
      zipExpiresInSeconds: zip?.expiresInSeconds ?? null,
      thanksUrl,
    },
  });
}
