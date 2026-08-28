import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "./audit.server";

const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";
const BATCH_SIZE = 100;
const DEFAULT_SUBJECT = "Aviso importante: novo canal de atendimento MSK SISTEM";
const DEFAULT_COMPOSER_SUBJECT = "Comunicado importante — MSK SISTEM";

type EligibleProfile = { id: string; email: string; name: string | null; profileId: string | null };
type CampaignRow = {
  id: string;
  campaign_key: string;
  subject: string;
  title?: string | null;
  message?: string | null;
  audience?: string | null;
  recipient_profile_id?: string | null;
  new_whatsapp: string;
  from_email: string | null;
  status: string;
  target_count: number;
  sent_count: number;
  failed_count: number;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

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

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) throw new Error("Número de WhatsApp inválido.");
  return digits;
}

function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function customEmailBody(title: string, message: string, recipient?: EligibleProfile) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");
  const greeting = recipient?.name?.trim() ? `Olá, ${escapeHtml(recipient.name.trim())}.` : "Olá.";

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#050806;font-family:Arial,Helvetica,sans-serif;color:#f4fff5">
    <div style="padding:32px 14px">
      <div style="max-width:640px;margin:0 auto;border:1px solid #39ff1450;border-radius:24px;overflow:hidden;background:#07110a;box-shadow:0 0 42px #39ff1417">
        <div style="height:4px;background:#39ff14"></div>
        <div style="padding:30px">
          <div style="display:inline-block;padding:7px 12px;border:1px solid #39ff1455;border-radius:999px;color:#7cff67;font-size:10px;font-weight:900;letter-spacing:1.5px">MSK SISTEM</div>
          <p style="margin:20px 0 8px;color:#b9c8bc;font-size:14px">${greeting}</p>
          <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.15">${safeTitle}</h1>
          <div style="margin-top:20px;color:#d8e7db;font-size:15px;line-height:1.75">${safeMessage}</div>
          <div style="margin-top:28px;padding-top:18px;border-top:1px solid #ffffff14;color:#7f9283;font-size:11px;line-height:1.6">
            Você está recebendo esta mensagem porque possui cadastro na plataforma MSK SISTEM.
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;

  const text = ["MSK SISTEM", "", greeting, "", title, "", message, "", "Mensagem enviada pela plataforma MSK SISTEM."].join("\n");
  return { html, text };
}

function whatsappLink(phone: string) {
  const text = encodeURIComponent("Olá! Preciso de suporte MSK SISTEM.");
  return `https://wa.me/${phone}?text=${text}`;
}

function outageEmailBody(phone: string) {
  const href = whatsappLink(phone);
  const prettyPhone = phone.startsWith("55") && phone.length >= 12 ? `+${phone}` : phone;
  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#050806;font-family:Arial,Helvetica,sans-serif;color:#f4fff5">
    <div style="padding:32px 14px">
      <div style="max-width:620px;margin:0 auto;border:1px solid #39ff1455;border-radius:22px;overflow:hidden;background:#07110a">
        <div style="padding:28px 28px 12px">
          <div style="display:inline-block;padding:7px 12px;border:1px solid #39ff1466;border-radius:999px;color:#7cff67;font-size:11px;font-weight:800;letter-spacing:1.4px">AVISO IMPORTANTE</div>
          <h1 style="margin:18px 0 12px;font-size:28px;line-height:1.08;color:#ffffff">Nosso WhatsApp principal está temporariamente indisponível.</h1>
          <p style="margin:0;color:#d8e7db;font-size:15px;line-height:1.65">Ativamos um canal alternativo para manter seu atendimento funcionando normalmente.</p>
        </div>
        <div style="margin:18px 28px;padding:20px;border-radius:16px;background:#0b1d10;border:1px solid #39ff143d;text-align:center">
          <div style="font-size:12px;color:#a7bdaa;text-transform:uppercase;letter-spacing:1.2px;font-weight:700">Novo número de suporte</div>
          <div style="margin:8px 0 16px;font-size:24px;color:#7cff67;font-weight:900">${escapeHtml(prettyPhone)}</div>
          <a href="${href}" style="display:inline-block;background:#39ff14;color:#041006;text-decoration:none;font-weight:900;padding:13px 20px;border-radius:11px">FALAR NO WHATSAPP</a>
        </div>
        <div style="padding:6px 28px 28px;color:#8da391;font-size:12px;line-height:1.55">A extensão MSK SISTEM continua funcionando normalmente.</div>
      </div>
    </div>
  </body>
</html>`;
  const text = [
    "AVISO IMPORTANTE — MSK SISTEM",
    "",
    "Nosso WhatsApp principal está temporariamente indisponível.",
    `Novo número de suporte: ${prettyPhone}`,
    `Fale conosco: ${href}`,
    "",
    "A extensão MSK SISTEM continua funcionando normalmente.",
  ].join("\n");
  return { html, text };
}

async function loadEligibleProfiles(): Promise<EligibleProfile[]> {
  const db = supabaseAdmin as any;
  const { data: adminRoles, error: roleError } = await db
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "super_admin"]);
  if (roleError) throw roleError;
  const adminIds = new Set((adminRoles ?? []).map((row: any) => String(row.user_id)));

  const profileNames = new Map<string, string>();
  const profileIds = new Set<string>();
  const { data: profileRows, error: profileError } = await db.from("profiles").select("id,name").limit(5000);
  if (profileError) throw profileError;
  for (const row of profileRows ?? []) {
    const id = String(row.id);
    profileIds.add(id);
    if (row.name) profileNames.set(id, String(row.name));
  }

  const dedup = new Map<string, EligibleProfile>();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data.users ?? [];

    for (const user of users) {
      const userId = String(user.id);
      if (adminIds.has(userId)) continue;
      const email = normalizeEmail(user.email);
      if (!email || dedup.has(email)) continue;

      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const fallbackName = metadata["name"] || metadata["full_name"] || metadata["display_name"];
      dedup.set(email, {
        id: userId,
        profileId: profileIds.has(userId) ? userId : null,
        email,
        name: profileNames.get(userId) ?? (fallbackName ? String(fallbackName) : null),
      });
    }

    if (users.length < 1000) break;
  }

  return [...dedup.values()].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "pt-BR"));
}

async function runCampaign(args: {
  campaignKey: string;
  subject: string;
  title: string;
  message: string;
  audience: "all" | "single";
  recipientProfileId?: string | null;
  newWhatsapp?: string;
  targets: EligibleProfile[];
  actorId: string;
  dedupeCompleted?: boolean;
  auditAction: string;
  body: (recipient: EligibleProfile) => { html: string; text: string };
}) {
  const db = supabaseAdmin as any;
  const config = emailConfig();
  if (!config.apiKey) throw new Error("O provedor de e-mail ainda não está configurado no servidor.");
  if (!config.fromEmail) throw new Error("O remetente verificado ainda não está configurado no servidor.");
  if (!args.targets.length) throw new Error("Nenhum cliente com e-mail válido foi encontrado para este envio.");

  let campaign: CampaignRow | null = null;
  const existing = await db.from("email_campaigns").select("*").eq("campaign_key", args.campaignKey).maybeSingle();
  if (existing.error) throw existing.error;
  campaign = existing.data as CampaignRow | null;

  if (args.dedupeCompleted && campaign?.status === "completed") {
    return {
      ok: true,
      alreadySent: true,
      campaignId: campaign.id,
      targetCount: campaign.target_count,
      sentCount: campaign.sent_count,
      failedCount: campaign.failed_count,
      status: campaign.status,
    };
  }

  const campaignPayload = {
    subject: args.subject,
    title: args.title,
    message: args.message,
    audience: args.audience,
    recipient_profile_id: args.recipientProfileId ?? null,
    new_whatsapp: args.newWhatsapp ?? "",
    from_email: config.fromEmail,
    status: "sending",
    target_count: args.targets.length,
    error: null,
    created_by: args.actorId,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (!campaign) {
    const created = await db
      .from("email_campaigns")
      .insert({ campaign_key: args.campaignKey, ...campaignPayload })
      .select("*")
      .single();
    if (created.error) throw created.error;
    campaign = created.data as CampaignRow;
  } else {
    const updated = await db
      .from("email_campaigns")
      .update(campaignPayload)
      .eq("id", campaign.id)
      .select("*")
      .single();
    if (updated.error) throw updated.error;
    campaign = updated.data as CampaignRow;
  }

  const recipientRows = args.targets.map((target) => ({
    campaign_id: campaign!.id,
    profile_id: target.profileId,
    email: target.email,
  }));
  for (let i = 0; i < recipientRows.length; i += 500) {
    const { error } = await db
      .from("email_campaign_recipients")
      .upsert(recipientRows.slice(i, i + 500), { onConflict: "campaign_id,email", ignoreDuplicates: true });
    if (error) throw error;
  }

  const recipientResult = await db
    .from("email_campaign_recipients")
    .select("id,email,status,campaign_id")
    .eq("campaign_id", campaign.id)
    .order("email", { ascending: true });
  if (recipientResult.error) throw recipientResult.error;

  const recipients = recipientResult.data ?? [];
  const targetByEmail = new Map(args.targets.map((target) => [target.email, target]));
  const batchErrors: string[] = [];

  for (let offset = 0, batchIndex = 0; offset < recipients.length; offset += BATCH_SIZE, batchIndex++) {
    const chunk = recipients.slice(offset, offset + BATCH_SIZE).filter((row: any) => row.status !== "sent");
    if (!chunk.length) continue;

    const ids = chunk.map((row: any) => row.id);
    await db
      .from("email_campaign_recipients")
      .update({ status: "sending", error: null, updated_at: new Date().toISOString() })
      .in("id", ids);

    const payload = chunk.map((row: any) => {
      const target = targetByEmail.get(String(row.email)) ?? { id: "", email: String(row.email), name: null, profileId: null };
      const body = args.body(target);
      return { from: config.fromEmail, to: [row.email], subject: args.subject, html: body.html, text: body.text };
    });

    try {
      const response = await fetch(RESEND_BATCH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `msk-email-${campaign.id}-${batchIndex}`,
        },
        body: JSON.stringify(payload),
      });
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = String(responseBody?.message || responseBody?.name || `Resend HTTP ${response.status}`).slice(0, 500);
        batchErrors.push(message);
        await db
          .from("email_campaign_recipients")
          .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
          .in("id", ids);
        continue;
      }

      const providerRows = Array.isArray(responseBody?.data) ? responseBody.data : [];
      const sentAt = new Date().toISOString();
      const updates = chunk.map((row: any, index: number) => ({
        id: row.id,
        campaign_id: campaign!.id,
        email: row.email,
        status: "sent",
        provider_message_id: providerRows[index]?.id ?? null,
        error: null,
        sent_at: sentAt,
        updated_at: sentAt,
      }));
      const saved = await db.from("email_campaign_recipients").upsert(updates, { onConflict: "id" });
      if (saved.error) throw saved.error;
    } catch (error) {
      const message = (error as Error).message.slice(0, 500);
      batchErrors.push(message);
      await db
        .from("email_campaign_recipients")
        .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
        .in("id", ids);
    }
  }

  const [sentResult, failedResult] = await Promise.all([
    db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("status", "sent"),
    db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("status", "failed"),
  ]);
  if (sentResult.error) throw sentResult.error;
  if (failedResult.error) throw failedResult.error;

  const sentCount = sentResult.count ?? 0;
  const failedCount = failedResult.count ?? 0;
  const status = failedCount === 0 && sentCount >= args.targets.length ? "completed" : sentCount > 0 ? "partial" : "failed";
  const errorSummary = batchErrors.length ? [...new Set(batchErrors)].join(" | ").slice(0, 1000) : null;

  await db
    .from("email_campaigns")
    .update({
      status,
      sent_count: sentCount,
      failed_count: failedCount,
      error: errorSummary,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaign.id);

  await logAudit({
    userId: args.actorId,
    action: args.auditAction,
    resource: "email_campaigns",
    resourceId: campaign.id,
    result: status === "failed" ? "failure" : "success",
    metadata: {
      audience: args.audience,
      targetCount: args.targets.length,
      sentCount,
      failedCount,
      provider: "resend",
    },
  });

  return {
    ok: status !== "failed",
    alreadySent: false,
    campaignId: campaign.id,
    targetCount: args.targets.length,
    sentCount,
    failedCount,
    status,
    error: errorSummary,
  };
}

export async function getEmailBroadcastOverview() {
  const db = supabaseAdmin as any;
  const config = emailConfig();
  const [recipients, campaignsResult] = await Promise.all([
    loadEligibleProfiles(),
    db
      .from("email_campaigns")
      .select("id,campaign_key,subject,title,message,audience,recipient_profile_id,new_whatsapp,from_email,status,target_count,sent_count,failed_count,error,created_at,completed_at")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  if (campaignsResult.error) throw campaignsResult.error;

  return {
    provider: "Resend",
    configured: !!config.apiKey && !!config.fromEmail,
    hasApiKey: !!config.apiKey,
    fromEmail: config.fromEmail ?? null,
    eligibleRecipients: recipients.length,
    recipients: recipients.slice(0, 500),
    campaigns: (campaignsResult.data ?? []) as CampaignRow[],
    defaultSubject: DEFAULT_COMPOSER_SUBJECT,
  };
}

export async function sendCustomEmailCampaign(
  input: { audience: "all" | "single"; profileId?: string; subject: string; title: string; message: string },
  actorId: string,
) {
  const allRecipients = await loadEligibleProfiles();
  const targets = input.audience === "single"
    ? allRecipients.filter((recipient) => recipient.id === input.profileId)
    : allRecipients;

  if (input.audience === "single" && !targets.length) {
    throw new Error("Cliente selecionado não foi encontrado ou não possui e-mail válido.");
  }

  const campaignKey = `custom:${Date.now()}:${crypto.randomUUID().slice(0, 8)}`;
  return runCampaign({
    campaignKey,
    subject: input.subject.trim().slice(0, 160),
    title: input.title.trim().slice(0, 140),
    message: input.message.trim().slice(0, 6000),
    audience: input.audience,
    recipientProfileId: input.audience === "single" ? targets[0]?.profileId ?? null : null,
    targets,
    actorId,
    auditAction: "email.custom_campaign",
    body: (recipient) => customEmailBody(input.title.trim(), input.message.trim(), recipient),
  });
}

export async function sendWhatsappOutageBroadcast(
  input: { newWhatsapp: string; subject?: string | undefined },
  actorId: string,
) {
  const phone = normalizePhone(input.newWhatsapp);
  const subject = (input.subject || DEFAULT_SUBJECT).trim().slice(0, 160);
  const targets = await loadEligibleProfiles();
  const title = "Nosso WhatsApp principal está temporariamente indisponível.";
  const message = `Novo número de suporte: ${phone}. A extensão MSK SISTEM continua funcionando normalmente.`;

  return runCampaign({
    campaignKey: `whatsapp-outage-v1:${phone}`,
    subject,
    title,
    message,
    audience: "all",
    newWhatsapp: phone,
    targets,
    actorId,
    dedupeCompleted: true,
    auditAction: "email.whatsapp_outage_broadcast",
    body: () => outageEmailBody(phone),
  });
}
