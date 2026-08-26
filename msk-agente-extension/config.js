const MSK_CONFIG_VALUE = Object.freeze({
  // Preenchido uma única vez pelo administrador após publicar as Edge Functions.
  // Usuários finais nunca informam URLs ou chaves.
  supabaseUrl: "https://iybjfmhqbblrppqoodyf.supabase.co",
  supabaseAnonKey: "sb_publishable_-aERipV8XmdiDq9UMERZUA_OIyOeyzD",
});

globalThis.MSK_CONFIG = MSK_CONFIG_VALUE;

/**
 * Proteções de runtime do MSK Agente.
 *
 * 1) A licença do Agente usa endpoints exclusivos `agent`, sem liberar tokens de
 *    Extensão/Clonador.
 * 2) Cada execução/aprovação reativa o projeto Lovable + repositório corretos
 *    imediatamente antes da operação.
 * 3) Operações que podem escrever código são serializadas para duas abas de
 *    clientes diferentes não trocarem o projeto ativo no meio da execução.
 */
if (!globalThis.__MSK_AGENT_FETCH_GUARD__) {
  globalThis.__MSK_AGENT_FETCH_GUARD__ = true;

  const nativeFetch = globalThis.fetch.bind(globalThis);
  let writeQueue = Promise.resolve();

  const requestUrl = (input) => {
    if (typeof input === "string") return input;
    if (input && typeof input.url === "string") return input.url;
    return String(input || "");
  };

  const parseBody = (body) => {
    if (typeof body !== "string" || !body.trim()) return {};
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const repoFullName = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    let path = raw;
    try {
      path = new URL(raw).pathname;
    } catch {
      path = raw.replace(/^git@github\.com:/i, "");
    }
    const clean = path.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "");
    return /^[^/\s]+\/[^/\s]+$/.test(clean) ? clean : "";
  };

  const projectRepo = async (projectId, payload) => {
    const direct =
      payload?.repository_url ||
      payload?.repositoryUrl ||
      payload?.connection_context?.github ||
      payload?.connectionContext?.github ||
      "";
    if (repoFullName(direct)) return repoFullName(direct);

    try {
      if (typeof chrome === "undefined" || !chrome.storage?.local) return "";
      const stored = await chrome.storage.local.get("mskProjectLinks");
      const cached = stored?.mskProjectLinks?.[projectId]?.repo || "";
      return repoFullName(cached);
    } catch {
      return "";
    }
  };

  const jsonError = (status, code, error) =>
    new Response(JSON.stringify({ ok: false, status, code, error }), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });

  const activateExactProject = async (payload, init) => {
    const lovableProjectId = String(
      payload?.lovable_project_id || payload?.lovableProjectId || "",
    ).trim();
    if (!lovableProjectId) {
      return jsonError(400, "PROJECT_REQUIRED", "Projeto Lovable não identificado.");
    }

    const repository = await projectRepo(lovableProjectId, payload);
    if (!repository) {
      return jsonError(
        409,
        "PROJECT_REPOSITORY_MISSING",
        "O repositório deste projeto não está conectado. Reconecte este projeto antes de aplicar a edição.",
      );
    }

    const activationUrl = `${MSK_CONFIG_VALUE.supabaseUrl}/functions/v1/msk-api?action=activate-project`;
    const activation = await nativeFetch(activationUrl, {
      method: "POST",
      headers: init?.headers,
      body: JSON.stringify({ repoFullName: repository, lovableProjectId }),
    });

    if (!activation.ok) return activation;

    const activationData = await activation.clone().json().catch(() => ({}));
    const returnedLovableId = String(
      activationData?.lovableProjectId ||
        activationData?.lovable_project_id ||
        activationData?.project?.lovableProjectId ||
        activationData?.project?.lovable_project_id ||
        "",
    ).trim();
    const returnedRepo = repoFullName(
      activationData?.repo ||
        activationData?.repoFullName ||
        activationData?.repo_full_name ||
        activationData?.project?.repo_full_name ||
        "",
    );

    if (returnedLovableId && returnedLovableId !== lovableProjectId) {
      return jsonError(
        409,
        "PROJECT_TARGET_MISMATCH",
        "O backend ativou outro projeto. A edição foi bloqueada por segurança.",
      );
    }
    if (returnedRepo && returnedRepo.toLowerCase() !== repository.toLowerCase()) {
      return jsonError(
        409,
        "REPOSITORY_TARGET_MISMATCH",
        "O backend ativou outro repositório. A edição foi bloqueada por segurança.",
      );
    }

    return null;
  };

  const enqueueWrite = (operation) => {
    const result = writeQueue.then(operation, operation);
    writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  globalThis.fetch = (input, init = {}) => {
    const url = requestUrl(input);

    // O MSK Agente nunca usa a rota da Extensão para validar seu token.
    if (url === "https://msksystem.online/api/public/license/validate") {
      return nativeFetch("https://msksystem.online/api/public/agent/license/validate", init);
    }
    if (url === "https://msksystem.online/api/public/license/heartbeat") {
      return nativeFetch("https://msksystem.online/api/public/agent/license/heartbeat", init);
    }

    const apiPrefix = `${MSK_CONFIG_VALUE.supabaseUrl}/functions/v1/msk-api`;
    if (url.startsWith(apiPrefix)) {
      const action = new URL(url).searchParams.get("action") || "";
      if (action === "run" || action === "approve-run") {
        return enqueueWrite(async () => {
          const payload = parseBody(init?.body);
          const targetError = await activateExactProject(payload, init);
          if (targetError) return targetError;
          return nativeFetch(input, init);
        });
      }
    }

    return nativeFetch(input, init);
  };
}
