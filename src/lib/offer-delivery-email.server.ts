import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RESEND_EMAIL_URL = "https://api.resend.com/emails";

function env(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export type OfferLinkDeliveryItem = {
  label: string;
  link: string;
  instructions?: string | null;
};

export async function sendOfferLinkDeliveryEmail(input: {
  transactionId: string;
  userId: string;
  items: OfferLinkDeliveryItem[];
}) {
  const items = input.items.filter((item) => /^https?:\/\//i.test(String(item.link ?? "").trim()));
  if (!items.length) return { ok: false, skipped: true };

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("name,email")
    .eq("id", input.userId)
    .maybeSingle();
  if (error) throw error;

  const email = normalizeEmail(profile?.email);
  if (!email) return { ok: false, skipped: true };

  const apiKey = env("RESEND_API_KEY");
  const fromEmail = env("MSK_EMAIL_FROM", "RESEND_FROM_EMAIL", "EMAIL_FROM");
  if (!apiKey || !fromEmail) {
    throw new Error("E-mail de entrega aguardando RESEND_API_KEY e MSK_EMAIL_FROM.");
  }

  const cards = items
    .map(
      (item) => `
        <div style="margin-top:14px;padding:18px;border-radius:16px;background:#08111f;border:1px solid #2f80ed55">
          <div style="font-size:11px;color:#8dbdff;text-transform:uppercase;letter-spacing:1.1px;font-weight:900">ENTREGA DIGITAL</div>
          <div style="margin-top:7px;color:#fff;font-size:18px;font-weight:900">${escapeHtml(item.label)}</div>
          ${item.instructions ? `<div style="margin-top:7px;color:#aab7c8;font-size:13px;line-height:1.55">${escapeHtml(item.instructions)}</div>` : ""}
          <a href="${escapeHtml(item.link)}" style="display:inline-block;margin-top:16px;background:#1677ff;color:#fff;text-decoration:none;font-weight:900;padding:13px 19px;border-radius:11px">ABRIR ENTREGA</a>
        </div>`,
    )
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#05070b;font-family:Arial,Helvetica,sans-serif;color:#f6f8fb"><div style="padding:32px 14px"><div style="max-width:640px;margin:0 auto;border:1px solid #2f80ed44;border-radius:24px;overflow:hidden;background:#080b12"><div style="height:4px;background:#1677ff"></div><div style="padding:28px"><div style="display:inline-block;padding:7px 12px;border:1px solid #2f80ed66;border-radius:999px;color:#8dbdff;font-size:11px;font-weight:800;letter-spacing:1.3px">COMPRA APROVADA</div><h1 style="margin:18px 0 10px;font-size:28px;line-height:1.08;color:#fff">Sua entrega está pronta.</h1><p style="margin:0;color:#aab7c8;font-size:15px;line-height:1.65">Olá, ${escapeHtml(profile?.name || "cliente")}. Use o botão abaixo para acessar o conteúdo da oferta que você comprou.</p>${cards}</div><div style="padding:0 28px 28px;color:#6f7b8c;font-size:11px;line-height:1.55">Mensagem operacional enviada pela plataforma MSK SISTEM.</div></div></div></body></html>`;

  const text = [
    "COMPRA APROVADA — MSK SISTEM",
    "",
    `Olá, ${profile?.name || "cliente"}. Sua entrega está pronta.`,
    "",
    ...items.flatMap((item) => [
      item.label,
      item.instructions || "",
      item.link,
      "",
    ]),
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch(RESEND_EMAIL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `offer-link:${input.transactionId}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: items.length === 1 ? `Sua entrega: ${items[0]!.label}` : "Suas entregas MSK estão prontas",
      html,
      text,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(body?.message || body?.name || `Resend HTTP ${response.status}`));
  }

  return { ok: true, providerMessageId: body?.id ?? null };
}
