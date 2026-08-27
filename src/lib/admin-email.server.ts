import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "./audit.server";

const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";
const BATCH_SIZE = 100;
const DEFAULT_SUBJECT = "Aviso importante: novo canal de atendimento MSK SISTEM";

type EligibleProfile = { id: string; email: string };
type CampaignRow = {
  id: string;
  campaign_key: string;
  subject: string;
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

function whatsappLink(phone: string) {
  const text = encodeURIComponent("Olá! Preciso de suporte MSK SISTEM.");
  return `https://wa.me/${phone}?text=${text}`;
}

function emailBody(phone: string) {
  const href = whatsappLink(phone);
  const prettyPhone = phone.startsWith("55") && phone.length >= 12 ? `+${phone}` : phone;
  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#050806;font-family:Arial,Helvetica,sans-serif;color:#f4fff5">
    <div style="padding:32px 14px">
      <div style="max-width:620px;margin:0 auto;border:1px solid #39ff1455;border-radius:22px;overflow:hidden;background:#07110a;box-shadow:0 0 36px #39ff141f">
        <div style="padding:28px 28px 12px">
          <div style="display:inline-block;padding:7px 12px;border:1px solid #39ff1466;border-radius:999px;color:#7cff67;font-size:11px;font-weight:800;letter-spacing:1.4px">AVISO IMPORTANTE</div>
          <h1 style="margin:18px 0 12px;font-size:28px;line-height:1.08;color:#ffffff">Nosso WhatsApp principal está temporariamente indisponível.</h1>
          <p style="margin:0;color:#d8e7db;font-size:15px;line-height:1.65">Devido ao alto volume de mensagens recebidas, nosso número principal ficou indisponível. Para que você continue recebendo atendimento normalmente, ativamos um canal alternativo.</p>
        </div>
        <div style="margin:18px 28px;padding:20px;border-radius:16px;background:#0b1d10;border:1px solid #39ff143d;text-align:center">
          <div style="font-size:12px;color:#a7bdaa;text-transform:uppercase;letter-spacing:1.2px;font-weight:700">Novo número de suporte</div>
          <div style="margin:8px 0 16px;font-size:24px;color:#7cff67;font-weight:900">${escapeHtml(prettyPhone)}</div>
          <a href="${href}" style="display:inline-block;background:#39ff14;color:#041006;text-decoration:none;font-weight:900;padding:13px 20px;border-radius:11px">FALAR NO WHATSAPP</a>
        </div>
        <div style="padding:6px 28px 28px">
          <p style="margin:0 0 8px;color:#ffffff;font-size:14px;font-weight:700">A extensão MSK SISTEM continua funcionando normalmente.</p>
          <p style="margin:0;color:#8da391;font-size:12px;line-height:1.55">Você está recebendo este aviso porque possui cadastro na plataforma MSK SISTEM. Esta mensagem é operacional e foi enviada para informar a mudança temporária do canal de suporte.</p>
        </div>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    "AVISO IMPORTANTE — MSK SISTEM",
    "",
    "Nosso WhatsApp principal está temporariamente indisponível devido ao alto volume de mensagens recebidas.",
    `Novo número de suporte: ${prettyPhone}`,
    `Fale conosco: ${href}`,
    "",
    "A extensão MSK SISTEM continua funcionando normalmente.",
    "Você recebeu esta mensagem porque possui cadastro na plataforma MSK SISTEM.",
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

  const dedup = new Map<string, EligibleProfile>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("profiles")
      .select("id,email")
      .not("email", "is", null)
      .range(from, from + 999);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      if (adminIds.has(String(row.id))) continue;
      const email = normalizeEmail(row.email);
      if (email && !dedup.has(email)) dedup.set(email, { id: String(row.id), email });
    }
    if (rows.length < 1000) break;
  }
  return [...dedup.values()].sort((a, b) => a.email.localeCompare(b.email));
}

export async function getEmailBroadcastOverview() {
  const db = supabaseAdmin as any;
  const config = emailConfig();
  const [recipients, campaignsResult] = await Promise.all([
    loadEligibleProfiles(),
    db
      .from("email_campaigns")
      .select("id,campaign_key,subject,new_whatsapp,from_email,status,target_count,sent_count,failed_count,error,created_at,completed_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (campaignsResult.error) throw campaignsResult.error;
  return {
    provider: "Resend",
    configured: !!config.apiKey && !!config.fromEmail,
    hasApiKey: !!config.apiKey,
    fromEmail: config.fromEmail ?? null,
    eligibleRecipients: recipients.length,
    campaigns: (campaignsResult.data ?? []) as CampaignRow[],
    defaultSubject: DEFAULT_SUBJECT,
  };
}

export async function sendWhatsappOutageBroadcast(
  input: { newWhatsapp: string; subject?: string },
  actorId: string,
) {
  const db = supabaseAdmin as any;
  const config = emailConfig();
  if (!config.apiKey) throw new Error("Configure RESEND_API_KEY nos secrets do servidor antes de enviar.");
  if (!config.fromEmail) throw new Error("Configure MSK_EMAIL_FROM com o e-mail do seu domínio verificado antes de enviar.");

  const phone = normalizePhone(input.newWhatsapp);
  const subject = (input.subject || DEFAULT_SUBJECT).trim().slice(0, 160);
  const campaignKey = `whatsapp-outage-v1:${phone}`;
  const targets = await loadEligibleProfiles();
  if (!targets.length) throw new Error("Nenhum cliente com e-mail válido foi encontrado.");

  let campaign: CampaignRow | null = null;
  const existing = await db
    .from("email_campaigns")
    .select("*")
    .eq("campaign_key", campaignKey)
    .maybeSingle();
  if (existing.error) throw existing.error;
  campaign = existing.data as CampaignRow | null;

  if (campaign?.status === "completed") {
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

  if (!campaign) {
    const created = await db
      .from("email_campaigns")
      .insert({
        campaign_key: campaignKey,
        subject,
        new_whatsapp: phone,
        from_email: config.fromEmail,
        status: "sending",
        target_count: targets.length,
        created_by: actorId,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (created.error) {
      const raced = await db.from("email_campaigns").select("*").eq("campaign_key", campaignKey).single();
      if (raced.error) throw created.error;
      campaign = raced.data as CampaignRow;
    } else {
      campaign = created.data as CampaignRow;
    }
  } else {
    const updated = await db
      .from("email_campaigns")
      .update({ status: "sending", error: null, updated_at: new Date().toISOString() })
      .eq("id", campaign.id)
      .select("*")
      .single();
    if (updated.error) throw updated.error;
    campaign = updated.data as CampaignRow;
  }

  const recipientRows = targets.map((target) => ({
    campaign_id: campaign!.id,
    profile_id: target.id,
    email: target.email,
  }));
  for (let i = 0; i < recipientRows.length; i += 500) {
    const { error } = await db
      .from("email_campaign_recipients")
      .upsert(recipientRows.slice(i, i + 500), { onConflict: "campaign_id,email", ignoreDuplicates: true });
    if (error) throw error;
  }

  await db
    .from("email_campaigns")
    .update({ target_count: targets.length, updated_at: new Date().toISOString() })
    .eq("id", campaign.id);

  const recipientResult = await db
    .from("email_campaign_recipients")
    .select("id,email,status,campaign_id")
    .eq("campaign_id", campaign.id)
    .order("email", { ascending: true });
  if (recipientResult.error) throw recipientResult.error;
  const recipients = recipientResult.data ?? [];
  const body = emailBody(phone);
  const batchErrors: string[] = [];

  for (let offset = 0, batchIndex = 0; offset < recipients.length; offset += BATCH_SIZE, batchIndex++) {
    const chunk = recipients.slice(offset, offset + BATCH_SIZE);
    if (chunk.every((row: any) => row.status === "sent")) continue;

    const unsentIds = chunk.filter((row: any) => row.status !== "sent").map((row: any) => row.id);
    if (unsentIds.length) {
      await db
        .from("email_campaign_recipients")
        .update({ status: "sending", error: null, updated_at: new Date().toISOString() })
        .in("id", unsentIds);
    }

    const payload = chunk.map((row: any) => ({
      from: config.fromEmail,
      to: [row.email],
      subject,
      html: body.html,
      text: body.text,
    }));

    try {
      const response = await fetch(RESEND_BATCH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `msk-wa-${campaign.id}-${batchIndex}`,
        },
        body: JSON.stringify(payload),
      });
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = String(responseBody?.message || responseBody?.name || `Resend HTTP ${response.status}`).slice(0, 500);
        batchErrors.push(message);
        if (unsentIds.length) {
          await db
            .from("email_campaign_recipients")
            .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
            .in("id", unsentIds);
        }
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
      if (unsentIds.length) {
        await db
          .from("email_campaign_recipients")
          .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
          .in("id", unsentIds);
      }
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
  const status = failedCount === 0 && sentCount >= targets.length ? "completed" : sentCount > 0 ? "partial" : "failed";
  const errorSummary = batchErrors.length ? [...new Set(batchErrors)].join(" | ").slice(0, 1000) : null;
  const completedAt = status === "completed" ? new Date().toISOString() : null;

  await db
    .from("email_campaigns")
    .update({
      status,
      sent_count: sentCount,
      failed_count: failedCount,
      error: errorSummary,
      completed_at: completedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaign.id);

  await logAudit({
    userId: actorId,
    action: "email.whatsapp_outage_broadcast",
    resource: "email_campaigns",
    resourceId: campaign.id,
    result: status === "failed" ? "failure" : "success",
    metadata: { phone, targetCount: targets.length, sentCount, failedCount, provider: "resend" },
  });

  return {
    ok: status !== "failed",
    alreadySent: false,
    campaignId: campaign.id,
    targetCount: targets.length,
    sentCount,
    failedCount,
    status,
    error: errorSummary,
  };
}
