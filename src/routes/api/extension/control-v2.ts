import { createFileRoute } from "@tanstack/react-router";
import { handleExtensionRemoteControl } from "@/lib/extension-remote-control.server";
import { verifyOfficialExtensionDigest } from "@/lib/extension-official-releases.server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cors(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const trusted =
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://") ||
    origin === "https://msksystem.online" ||
    origin.endsWith(".msksystem.online");
  return {
    ...(trusted ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-headers": [
      "content-type",
      "authorization",
      "x-msk-installation-id",
      "x-msk-extension-version",
      "x-msk-extension-id",
      "x-msk-integrity-digest",
      "x-msk-integrity-ok",
    ].join(", "),
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...cors(request),
    },
  });
}

function verifyOfficialBuild(request: Request) {
  const version = request.headers.get("x-msk-extension-version")?.trim() ?? "";
  const digest = request.headers.get("x-msk-integrity-digest")?.trim() ?? "";
  const localIntegrity = request.headers.get("x-msk-integrity-ok")?.trim() ?? "";
  const result = verifyOfficialExtensionDigest(version, digest);

  if (!result.official) {
    const code =
      result.reason === "VERSION_NOT_REGISTERED"
        ? "EXTENSION_VERSION_NOT_REGISTERED"
        : "INTEGRITY_BUILD_NOT_APPROVED";
    const message =
      result.reason === "VERSION_NOT_REGISTERED"
        ? "Esta versão ainda não está registrada como versão oficial MSK. Atualize a extensão."
        : "Esta cópia não corresponde ao build oficial da extensão MSK.";
    return json(request, { ok: false, blocked: true, code, message }, 403);
  }

  if (localIntegrity !== "1") {
    return json(request, {
      ok: false,
      blocked: true,
      code: "INTEGRITY_LOCAL_FAILED",
      message: "O Guardião da extensão detectou arquivos alterados. Reinstale o pacote oficial.",
    }, 403);
  }

  return null;
}

async function acknowledgeBatch(request: Request, commandIds: string[]) {
  const unique = [...new Set(commandIds.filter((id) => UUID.test(id)))].slice(0, 25);
  if (!unique.length) {
    return json(request, { ok: false, code: "INVALID_ACK", message: "Confirmação inválida." }, 400);
  }

  const results: Array<{ command_id: string; ok: boolean; status: number }> = [];
  for (const commandId of unique) {
    const forwarded = new Request(request.url, {
      method: "POST",
      headers: new Headers(request.headers),
      body: JSON.stringify({ command_id: commandId }),
    });
    const response = await handleExtensionRemoteControl(forwarded);
    results.push({ command_id: commandId, ok: response.ok, status: response.status });
  }
  const failed = results.filter((item) => !item.ok);
  return json(
    request,
    { ok: failed.length === 0, acknowledged: results.length - failed.length, failed },
    failed.length ? 207 : 200,
  );
}

async function securedV2(request: Request) {
  const integrityError = verifyOfficialBuild(request);
  if (integrityError) return integrityError;

  if (request.method === "POST") {
    const body = (await request.clone().json().catch(() => null)) as Record<string, unknown> | null;
    const commandIds = body?.["command_ids"];
    if (Array.isArray(commandIds)) {
      return acknowledgeBatch(request, commandIds.map(String));
    }
  }

  // Autenticação, licença, ownership da instalação, bloqueio remoto e identidade
  // continuam sendo tratados pelo mesmo serviço oficial já usado pelo MSK.
  return handleExtensionRemoteControl(request);
}

export const Route = createFileRoute("/api/extension/control-v2")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => new Response(null, { status: 204, headers: cors(request) }),
      GET: ({ request }) => securedV2(request),
      POST: ({ request }) => securedV2(request),
    },
  },
});
