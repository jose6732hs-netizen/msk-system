import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { findLicenseByToken, rateLimit } from "./license.server";

const db = supabaseAdmin as any;
const installationSchema = z.string().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/);
const versionSchema = z.string().min(1).max(64).regex(/^[0-9A-Za-z.+_-]+$/);
const ackSchema = z.object({ command_id: z.string().uuid() });
const severitySchema = z.enum(["info", "success", "warning", "critical"]);
const replySchema = z.object({
  kind: z.enum(["reply", "diagnostic"]),
  command_id: z.string().uuid().optional().nullable(),
  body: z.string().trim().max(2000).optional().nullable(),
  payload: z.record(z.unknown()).optional(),
});

const SENSITIVE_REPLY_KEY = /(token|secret|password|cookie|authorization|api[_-]?key|private)/i;

function sanitizeReplyPayload(value: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value).slice(0, 40)) {
    if (SENSITIVE_REPLY_KEY.test(key)) {
      output[key.slice(0, 60)] = "[REDACTED]";
      continue;
    }
    if (raw == null || typeof raw === "boolean" || typeof raw === "number") output[key.slice(0, 60)] = raw;
    else if (typeof raw === "string") output[key.slice(0, 60)] = raw.slice(0, 600);
    else output[key.slice(0, 60)] = JSON.stringify(raw ?? null).slice(0, 900);
  }
  const encoded = JSON.stringify(output);
  return encoded.length > 15_000 ? { truncated: true, size: encoded.length } : output;
}

function cors(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const allowed = origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://") || origin === "https://msksystem.online";
  return {
    ...(allowed ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-headers": "content-type, authorization, x-msk-installation-id, x-msk-extension-version",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors(request) },
  });
}

export function remoteControlPreflight(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

function bearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function activeLicense(row: any) {
  if (!row || String(row.status) !== "active") return false;
  const now = Date.now();
  if (row.starts_at && Date.parse(row.starts_at) > now) return false;
  if (row.expires_at && Date.parse(row.expires_at) <= now) return false;
  return true;
}

async function resolveLicense(request: Request) {
  const token = bearer(request);
  if (!token) return null;

  // Contrato atual: a extensão envia o token da licença diretamente.
  const direct = (await findLicenseByToken(token)) as any;
  if (activeLicense(direct)) return direct;

  // Compatibilidade com versões que ainda enviam o JWT da conta MSK,
  // igual ao endpoint de heartbeat. Assim o canal remoto continua
  // entregando mensagens sem exigir reinstalação imediata da extensão.
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: licenses } = await db
    .from("licenses")
    .select("id,user_id,status,starts_at,expires_at,created_at")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);

  return (licenses ?? []).find(activeLicense) ?? null;
}

type Identity = { userId: string; licenseId: string; installationId: string; version: string };

function identityHints(request: Request) {
  const url = new URL(request.url);
  const installationId = (
    request.headers.get("x-msk-installation-id") ||
    url.searchParams.get("installation_id") ||
    url.searchParams.get("installationId") ||
    ""
  ).trim();
  const version = (
    request.headers.get("x-msk-extension-version") ||
    url.searchParams.get("version") ||
    url.searchParams.get("extension_version") ||
    ""
  ).trim();
  return { installationId, version };
}

async function compatibleIdentity(request: Request, userId: string) {
  const hinted = identityHints(request);
  let installationId = hinted.installationId;
  let version = hinted.version;

  const installationValid = installationSchema.safeParse(installationId).success;
  const versionValid = versionSchema.safeParse(version).success;
  if (installationValid && versionValid) return { installationId, version };

  // Versões legadas do MSK já fazem heartbeat, mas algumas não enviam os
  // cabeçalhos novos no polling do canal remoto. Nesse caso usamos a última
  // instalação registrada para o próprio usuário, sem aceitar identidade de
  // outro usuário e sem exigir reinstalação da extensão.
  const { data: installations } = await db
    .from("extension_installations")
    .select("installation_id,version,last_seen_at")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false })
    .limit(20);

  const fallback = (installations ?? []).find((row: any) =>
    installationSchema.safeParse(String(row.installation_id ?? "")).success,
  );

  if (!installationValid && fallback) installationId = String(fallback.installation_id);
  if (!versionValid) {
    const fallbackVersion = String(fallback?.version ?? "legacy");
    version = versionSchema.safeParse(fallbackVersion).success ? fallbackVersion : "legacy";
  }

  return { installationId, version };
}

async function authenticate(request: Request): Promise<{ identity?: Identity; response?: Response }> {
  const token = bearer(request);
  if (!token) return { response: json(request, { ok: false, code: "AUTH_REQUIRED", message: "Conecte sua licença MSK novamente." }, 401) };

  const license = await resolveLicense(request);
  if (!license) return { response: json(request, { ok: false, code: "LICENSE_INVALID", message: "Sua licença não pôde ser confirmada." }, 401) };

  const { installationId, version } = await compatibleIdentity(request, String(license.user_id));
  if (!installationSchema.safeParse(installationId).success || !versionSchema.safeParse(version).success) {
    return { response: json(request, { ok: false, code: "INVALID_EXTENSION_IDENTITY", message: "Identificação da extensão inválida." }, 400) };
  }

  const { data: existing } = await db.from("extension_installations").select("user_id").eq("installation_id", installationId).maybeSingle();
  if (existing?.user_id && String(existing.user_id) !== String(license.user_id)) {
    return { response: json(request, { ok: false, code: "INSTALLATION_OWNERSHIP_MISMATCH", message: "Esta instalação precisa ser reconectada." }, 409) };
  }

  return { identity: { userId: String(license.user_id), licenseId: String(license.id), installationId, version } };
}

async function remoteState(identity: Identity) {
  const { data: controls } = await db
    .from("extension_remote_controls")
    .select("id,installation_id,blocked,block_reason,block_message,updated_at")
    .eq("user_id", identity.userId)
    .or(`installation_id.is.null,installation_id.eq.${identity.installationId}`)
    .order("updated_at", { ascending: false });
  const applicable = controls ?? [];
  const blocked = applicable.find((row: any) => row.blocked === true) ?? null;
  return {
    blocked: !!blocked,
    reason: blocked?.block_reason ?? null,
    message: blocked?.block_message ?? null,
    updated_at: blocked?.updated_at ?? applicable[0]?.updated_at ?? null,
  };
}

export function clientIp(request: Request) {
  const raw =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    (request.headers.get("x-forwarded-for") ?? "").split(",")[0] ||
    "";
  const ip = raw.trim();
  return ip && ip.length <= 60 ? ip : null;
}

const extensionIdSchema = z.string().min(8).max(120).regex(/^[A-Za-z0-9._-]+$/);

/**
 * Antifraude: confere se a instalação continua rodando com a mesma identidade
 * de extensão registrada na primeira conexão. Um clone empacotado com outro ID
 * aparece aqui como suspeito e pode ser bloqueado com um clique no painel.
 */
async function integrityGuard(identity: Identity, request: Request) {
  const headerId = (request.headers.get("x-msk-extension-id") ?? "").trim();
  const extensionId = extensionIdSchema.safeParse(headerId).success ? headerId : null;

  const { data: rowData } = await db
    .from("extension_installations")
    .select("id,extension_id,first_extension_id,suspicious,suspicion_reason,blocked,block_reason")
    .eq("installation_id", identity.installationId)
    .eq("user_id", identity.userId)
    .maybeSingle();
  const row = (rowData ?? null) as any;

  const patch: Record<string, unknown> = {};
  let suspicious = !!row?.suspicious;
  let reason: string | null = row?.suspicion_reason ?? null;

  if (extensionId) {
    patch["extension_id"] = extensionId;
    if (!row?.first_extension_id) patch["first_extension_id"] = extensionId;
    else if (String(row.first_extension_id) !== extensionId) {
      suspicious = true;
      reason = "ID da extensão mudou (possível cópia/clone da MSK Agente).";
      patch["suspicious"] = true;
      patch["suspicion_reason"] = reason;
    }
  }

  if (Object.keys(patch).length && row?.id) {
    await db.from("extension_installations").update(patch).eq("id", row.id);
  }


  return {
    installationBlocked: !!row?.blocked,
    installationBlockReason: row?.block_reason ?? null,
    suspicious,
    suspicionReason: reason,
  };
}

export async function handleExtensionRemoteControl(request: Request) {
  const auth = await authenticate(request);
  if (!auth.identity) return auth.response!;
  const identity = auth.identity;
  const ip = clientIp(request);
  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 300) || null;


  if (request.method === "POST") {
    if (!(await rateLimit("extension-control-ack", `${identity.userId}:${identity.installationId}`, 60))) {
      return json(request, { ok: false, code: "RATE_LIMITED", message: "Muitas confirmações em pouco tempo." }, 429);
    }
    const body = (await request.json().catch(() => null)) as any;

    // Canal de volta: resposta escrita pelo usuário ou diagnóstico solicitado pelo admin.
    const replyParsed = replySchema.safeParse(body);
    if (replyParsed.success) {
      const { error } = await db.from("extension_replies").insert({
        command_id: replyParsed.data.command_id ?? null,
        user_id: identity.userId,
        installation_id: identity.installationId,
        kind: replyParsed.data.kind,
        body: replyParsed.data.body?.slice(0, 2000) ?? null,
        payload: sanitizeReplyPayload(replyParsed.data.payload ?? {}),
        ip_address: ip,
        extension_version: identity.version,
      });
      if (error) return json(request, { ok: false, code: "REPLY_FAILED", message: "Não foi possível registrar a resposta." }, 500);
      if (replyParsed.data.command_id) {
        await db
          .from("extension_remote_commands")
          .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
          .eq("id", replyParsed.data.command_id)
          .eq("user_id", identity.userId);
      }
      return json(request, { ok: true, received: true });
    }

    const parsed = ackSchema.safeParse(body);
    if (!parsed.success) return json(request, { ok: false, code: "INVALID_ACK", message: "Confirmação inválida." }, 400);
    const { data: command } = await db
      .from("extension_remote_commands")
      .select("id,user_id,installation_id,status")
      .eq("id", parsed.data.command_id)
      .eq("user_id", identity.userId)
      .maybeSingle();
    if (!command || (command.installation_id && command.installation_id !== identity.installationId)) {
      return json(request, { ok: false, code: "COMMAND_NOT_FOUND", message: "Comando não encontrado." }, 404);
    }
    await db.from("extension_remote_commands").update({ status: "acknowledged", acknowledged_at: new Date().toISOString() }).eq("id", command.id);
    return json(request, { ok: true });
  }

  if (!(await rateLimit("extension-control-poll", `${identity.userId}:${identity.installationId}`, 10))) {
    return json(request, { ok: false, code: "RATE_LIMITED", message: "Consulta muito frequente." }, 429);
  }

  const now = new Date().toISOString();
  const [baseControl, commandResult, integrity] = await Promise.all([
    remoteState(identity),
    db
      .from("extension_remote_commands")
      .select("id,command_type,title,message,severity,payload,status,created_at,expires_at,delivered_at,delivery_count")
      .eq("user_id", identity.userId)
      .in("status", ["pending", "delivered"])
      .gt("expires_at", now)
      .or(`installation_id.is.null,installation_id.eq.${identity.installationId}`)
      .order("created_at", { ascending: true })
      .limit(10),
    integrityGuard(identity, request),
  ]);

  const control = integrity.installationBlocked
    ? {
        blocked: true,
        reason: integrity.installationBlockReason ?? "Instalação bloqueada pelo suporte MSK.",
        message: integrity.installationBlockReason ?? "Esta instalação do MSK Agente foi bloqueada. Fale com o suporte.",
        updated_at: now,
      }
    : baseControl;

  const commands = commandResult.data ?? [];
  if (commands.length) {
    await Promise.all(commands.map((command: any) =>
      db.from("extension_remote_commands").update({
        status: "delivered",
        delivered_at: command.delivered_at ?? now,
        last_delivery_at: now,
        delivery_count: Math.min(1000, Number(command.delivery_count ?? 0) + 1),
      }).eq("id", command.id).eq("user_id", identity.userId),
    ));
  }

  await db
    .from("extension_installations")
    .update({ last_seen_at: now, last_activity_at: now, version: identity.version, ip_address: ip, user_agent: userAgent })
    .eq("installation_id", identity.installationId)
    .eq("user_id", identity.userId);

  return json(request, {
    ok: true,
    server_time: now,
    control,
    integrity: { suspicious: integrity.suspicious, reason: integrity.suspicionReason },
    commands: commands.map((command: any) => ({
      id: command.id,
      type: command.command_type,
      command_type: command.command_type,
      title: command.title,
      message: command.message,
      severity: command.severity,
      payload: command.payload ?? {},
      created_at: command.created_at,
      expires_at: command.expires_at,
    })),
    poll_after_seconds: 15,
  });

}


async function profileMap(userIds: string[]) {
  if (!userIds.length) return new Map<string, any>();
  const { data } = await db.from("profiles").select("id,name,email").in("id", userIds.slice(0, 500));
  return new Map((data ?? []).map((row: any) => [String(row.id), row]));
}

async function commandTargets(userId: string, installationId?: string | null) {
  if (installationId) return [installationId];
  const { data } = await db.from("extension_installations").select("installation_id").eq("user_id", userId).limit(100);
  const ids = [...new Set((data ?? []).map((row: any) => String(row.installation_id)).filter(Boolean))];
  return ids.length ? ids : [null];
}

export async function loadRemoteControlAdmin() {
  const [{ data: installations }, { data: controls }, { data: commands }, { data: replies }] = await Promise.all([
    db.from("extension_installations").select("id,user_id,installation_id,version,browser,os,ip_address,user_agent,last_url,last_seen_at,last_activity_at,extension_id,first_extension_id,suspicious,suspicion_reason,blocked,block_reason").order("last_seen_at", { ascending: false }).limit(1000),
    db.from("extension_remote_controls").select("*").order("updated_at", { ascending: false }).limit(1000),
    db.from("extension_remote_commands").select("id,user_id,installation_id,command_type,title,message,severity,status,created_at,delivered_at,acknowledged_at,expires_at").order("created_at", { ascending: false }).limit(300),
    db.from("extension_replies").select("id,command_id,user_id,installation_id,kind,body,payload,ip_address,extension_version,read_at,created_at").order("created_at", { ascending: false }).limit(300),
  ]);
  const installRows = installations ?? [];
  const userIds: string[] = [...new Set(installRows.map((row: any) => String(row.user_id)))] as string[];
  const profiles = await profileMap(userIds);
  const controlRows = controls ?? [];
  const replyRows = replies ?? [];
  const clients = userIds.map((userId) => {
    const rows = installRows.filter((row: any) => String(row.user_id) === userId);
    const globalControl = controlRows.find((row: any) => String(row.user_id) === userId && row.installation_id == null) ?? null;
    const clientReplies = replyRows.filter((row: any) => String(row.user_id) === userId);
    return {
      user_id: userId,
      name: profiles.get(userId)?.name ?? "Cliente",
      email: profiles.get(userId)?.email ?? "—",
      blocked: !!globalControl?.blocked,
      block_reason: globalControl?.block_reason ?? null,
      block_message: globalControl?.block_message ?? null,
      installations: rows,
      last_seen_at: rows[0]?.last_seen_at ?? null,
      version: rows[0]?.version ?? "—",
      ip_address: rows[0]?.ip_address ?? null,
      unread_replies: clientReplies.filter((row: any) => !row.read_at).length,
      replies_count: clientReplies.length,
      suspicious: rows.some((row: any) => row.suspicious === true),
      installation_blocked: rows.some((row: any) => row.blocked === true),
    };
  });
  const suspicious = installRows
    .filter((row: any) => row.suspicious === true || row.blocked === true)
    .map((row: any) => ({
      ...row,
      name: profiles.get(String(row.user_id))?.name ?? "Cliente",
      email: profiles.get(String(row.user_id))?.email ?? "—",
    }));
  return {
    clients,
    installations: installRows.map((row: any) => ({
      ...row,
      name: profiles.get(String(row.user_id))?.name ?? "Cliente",
      email: profiles.get(String(row.user_id))?.email ?? "—",
    })),
    suspicious,
    commands: commands ?? [],
    replies: replyRows.map((row: any) => ({ ...row, name: profiles.get(String(row.user_id))?.name ?? "Cliente", email: profiles.get(String(row.user_id))?.email ?? "—" })),
    generated_at: new Date().toISOString(),
  };
}

/** Bloqueia (ou libera) uma instalação específica — usado contra clones. */
export async function setInstallationBlock(
  input: { installationId: string; blocked: boolean; reason?: string | null },
  adminUserId: string,
) {
  const { data, error } = await db
    .from("extension_installations")
    .update({
      blocked: input.blocked,
      block_reason: input.blocked ? String(input.reason || "Instalação bloqueada pelo suporte MSK.").slice(0, 300) : null,
      suspicious: input.blocked ? true : false,
      suspicion_reason: input.blocked ? String(input.reason || "Bloqueio manual do painel MSK.").slice(0, 300) : null,
    })
    .eq("installation_id", input.installationId)
    .select("id,user_id,installation_id,blocked");
  if (error) throw error;
  const row = (data ?? [])[0];
  if (row?.user_id) {
    await db.from("extension_remote_commands").insert({
      user_id: row.user_id,
      installation_id: input.installationId,
      command_type: input.blocked ? "block" : "unblock",
      title: input.blocked ? "Instalação bloqueada" : "Instalação liberada",
      message: input.blocked
        ? String(input.reason || "Esta instalação do MSK Agente foi bloqueada pelo suporte.")
        : "Esta instalação do MSK Agente foi liberada novamente.",
      severity: input.blocked ? "critical" : "success",
      status: "pending",
      created_by: adminUserId,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
    });
  }
  return { ok: true, blocked: input.blocked };
}


const ACTION_LABELS: Record<string, { title: string; message: string; severity: z.infer<typeof severitySchema> }> = {
  refresh: { title: "Atualizando ambiente", message: "O administrador solicitou a recarga do MSK Agente.", severity: "info" },
  revalidate_license: { title: "Revalidando licença", message: "Sua licença está sendo revalidada automaticamente.", severity: "info" },
  clear_cache: { title: "Limpando cache local", message: "O cache local do MSK Agente foi limpo pelo suporte.", severity: "warning" },
  diagnostic: { title: "Diagnóstico solicitado", message: "O suporte MSK solicitou um diagnóstico desta instalação.", severity: "info" },
  update_notice: { title: "Atualização disponível", message: "Uma nova versão do MSK Agente está publicada. Atualize para continuar com tudo funcionando.", severity: "warning" },
};

export async function sendRemoteAction(
  input: { userId: string; installationId?: string | null; action: keyof typeof ACTION_LABELS; payload?: Record<string, unknown> },
  adminUserId: string,
) {
  const preset = ACTION_LABELS[input.action];
  if (!preset) throw new Error("Ação remota inválida.");
  const targets = await commandTargets(input.userId, input.installationId);
  const rows = targets.map((target) => ({
    user_id: input.userId,
    installation_id: target,
    command_type: input.action,
    title: preset.title,
    message: preset.message,
    severity: preset.severity,
    status: "pending",
    payload: input.payload ?? {},
    created_by: adminUserId,
    expires_at: new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString(),
  }));
  const { data, error } = await db.from("extension_remote_commands").insert(rows).select("id,installation_id,status");
  if (error) throw error;
  return { ok: true, deliveries: data ?? [] };
}

export async function broadcastUpdateNotice(
  input: { version: string; downloadUrl?: string | null; mandatory?: boolean },
  adminUserId: string,
) {
  const { data: installations } = await db
    .from("extension_installations")
    .select("user_id,installation_id,version")
    .order("last_seen_at", { ascending: false })
    .limit(5000);
  const targets = (installations ?? []).filter((row: any) => String(row.version ?? "") !== input.version);
  if (!targets.length) return { ok: true, deliveries: 0 };
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString();
  const rows = targets.map((row: any) => ({
    user_id: row.user_id,
    installation_id: row.installation_id,
    command_type: "update_notice",
    title: `MSK Agente ${input.version} disponível`,
    message: input.mandatory
      ? `A versão ${input.version} é obrigatória. Atualize agora para continuar usando o MSK Agente.`
      : `A versão ${input.version} do MSK Agente foi publicada. Atualize para receber as melhorias.`,
    severity: input.mandatory ? "critical" : "warning",
    status: "pending",
    payload: { version: input.version, download_url: input.downloadUrl ?? null, mandatory: !!input.mandatory },
    created_by: adminUserId,
    expires_at: expiresAt,
  }));
  const { error } = await db.from("extension_remote_commands").insert(rows);
  if (error) throw error;
  return { ok: true, deliveries: rows.length };
}

export async function markRepliesRead(userId: string) {
  const { error } = await db
    .from("extension_replies")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return { ok: true };
}


export async function sendRemoteMessage(input: { userId: string; installationId?: string | null; title: string; message: string; severity: z.infer<typeof severitySchema> }, adminUserId: string) {
  const targets = await commandTargets(input.userId, input.installationId);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
  const rows = targets.map((target) => ({
    user_id: input.userId,
    installation_id: target,
    command_type: "message",
    title: input.title.slice(0, 180),
    message: input.message.slice(0, 2000),
    severity: severitySchema.parse(input.severity),
    status: "pending",
    created_by: adminUserId,
    expires_at: expiresAt,
  }));
  const { data, error } = await db.from("extension_remote_commands").insert(rows).select("id,status,installation_id,created_at");
  if (error) throw error;
  return { ok: true, deliveries: data ?? [] };
}

export async function setRemoteBlock(input: { userId: string; blocked: boolean; reason?: string | null; message?: string | null }, adminUserId: string) {
  const now = new Date().toISOString();
  const { data: existing } = await db.from("extension_remote_controls").select("id").eq("user_id", input.userId).is("installation_id", null).maybeSingle();
  const patch = {
    blocked: input.blocked,
    block_reason: input.blocked ? String(input.reason || "Bloqueado pelo administrador").slice(0, 300) : null,
    block_message: input.blocked ? String(input.message || "Seu acesso ao MSK Agente foi temporariamente bloqueado. Entre em contato com o suporte.").slice(0, 1000) : null,
    updated_by: adminUserId,
    updated_at: now,
  };
  if (existing?.id) {
    const { error } = await db
      .from("extension_remote_controls")
      .update(patch)
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await db.from("extension_remote_controls").insert({ user_id: input.userId, installation_id: null, ...patch });
    if (error) throw error;
  }

  const targets = await commandTargets(input.userId, null);
  const rows = targets.map((target) => ({
    user_id: input.userId,
    installation_id: target,
    command_type: input.blocked ? "block" : "unblock",
    title: input.blocked ? "Acesso bloqueado" : "Acesso liberado",
    message: input.blocked ? patch.block_message : "Seu acesso ao MSK Agente foi liberado novamente.",
    severity: input.blocked ? "critical" : "success",
    status: "pending",
    created_by: adminUserId,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
  }));
  const { error: commandError } = await db.from("extension_remote_commands").insert(rows);
  if (commandError) throw commandError;
  return { ok: true, blocked: input.blocked, updated_at: now, targets: targets.length };
}

export async function isAgentUserRemotelyBlocked(userId: string) {
  const { data } = await db.from("extension_remote_controls").select("blocked,block_reason,block_message").eq("user_id", userId).is("installation_id", null).eq("blocked", true).maybeSingle();
  return data ?? null;
}
