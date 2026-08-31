// MSK direct GitHub/AI transport. Kept outside background.js so the protected motor fingerprint remains stable.
import './config.js';

const mskDirectConfig = () => globalThis.MSK_CONFIG || {};
const mskDirectFetchWithTimeout = async (url, init = {}, timeout = 15000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), Math.max(1000, Number(timeout) || 15000));
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
};
const mskDirectActiveAuthSession = async () => {
  const saved = await chrome.storage.local.get('mskAuthSession');
  const session = saved?.mskAuthSession || null;
  return session?.accessToken ? session : null;
};
const mskDirectActiveLicense = async () => {
  const saved = await chrome.storage.local.get('mskLicense');
  const license = saved?.mskLicense || null;
  const email = String(license?.email || '').trim().toLowerCase();
  const token = String(license?.token || '').trim();
  const status = String(license?.status || 'active').trim().toLowerCase();
  const expiryRaw = license?.expires_at || license?.expiresAt || license?.license_expires_at || '';
  const expiresAt = expiryRaw ? Date.parse(String(expiryRaw)) : NaN;
  const denied = new Set(['expired', 'revoked', 'inactive', 'blocked', 'suspended', 'cancelled', 'canceled']);
  if (!token || license?.valid === false || denied.has(status)) {
    await chrome.storage.local.set({ mskLicenseAccessGranted: false }).catch(() => {});
    return null;
  }
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    await chrome.storage.local.set({ mskLicenseAccessGranted: false }).catch(() => {});
    return null;
  }
  await chrome.storage.local.set({ mskLicenseAccessGranted: true }).catch(() => {});
  return { ...license, email, token, status };
};
const mskDirectEnsureInstallationId = async () => {
  const key = 'mskInstallationId';
  const saved = await chrome.storage.local.get(key);
  let value = String(saved?.[key] || '').trim();
  if (/^[A-Za-z0-9_-]{16,80}$/.test(value)) return value;
  value = `msk_${crypto.randomUUID().replace(/-/g, '')}`;
  await chrome.storage.local.set({ [key]: value });
  return value;
};

/* MSK_DIRECT_AGENT_TRANSPORT_V1 */
const mskDirectAgentSessionKey = projectId => `mskDirectSession:${projectId}`;
const mskDirectSanitizeClientError = (data = {}, status = 0) => {
  const source = data && typeof data === 'object' ? { ...data } : {};
  const raw = `${String(source?.code || '')} ${String(source?.error || '')} ${String(source?.message || '')}`;
  const internalGithubFailure = /GITHUB_APP_PRIVATE_KEY_INVALID|GITHUB_APP_CREDENTIALS_INVALID|PRIVATE\s*KEY|chave\s+privada|ASN\.?1|PKCS|RSA\s+PRIVATE|GITHUB_APP_PRIVATE_KEY|incorrect length|constructed/i.test(raw);
  const internalAiFailure = /Nenhuma API da IA foi configurada|Cadastre a chave no painel|BAI_API_KEY|api_key_ciphertext|MSK_TOKEN_ENCRYPTION_KEY|B\.AI\s*\d{3}|MSK_AI_UNAVAILABLE_INTERNAL/i.test(raw);

  // Nunca expor fornecedor/modelo interno ao cliente. A interface pública usa somente a marca MSK IA.
  if (Object.prototype.hasOwnProperty.call(source, 'provider')) source.provider = 'MSK';
  if (Object.prototype.hasOwnProperty.call(source, 'model')) source.model = 'MSK-IA';

  if (internalGithubFailure) {
    return {
      ...source,
      ok: false,
      connected: false,
      status: Number(status || source?.status || 500),
      code: 'GITHUB_TEMPORARILY_UNAVAILABLE',
      error: 'Não foi possível concluir a conexão com o GitHub agora. Tente novamente em instantes.',
      message: 'Não foi possível concluir a conexão com o GitHub agora. Tente novamente em instantes.'
    };
  }
  if (internalAiFailure) {
    return {
      ...source,
      ok: false,
      status: Number(status || source?.status || 500),
      code: 'MSK_AI_TEMPORARILY_UNAVAILABLE',
      error: 'A inteligência MSK está temporariamente indisponível. Tente novamente em instantes.',
      message: 'A inteligência MSK está temporariamente indisponível. Tente novamente em instantes.'
    };
  }
  return source;
};
const mskDirectAgentApi = async (action, payload = {}) => {
  const projectId = String(payload.lovable_project_id || '').trim();
  const config = mskDirectConfig();
  if (!config?.supabaseUrl || !config?.supabaseAnonKey) return { ok: false, status: 500, error: 'Configuração MSK indisponível.' };
  const saved = projectId ? await chrome.storage.local.get(mskDirectAgentSessionKey(projectId)) : {};
  const sessionToken = projectId ? String(saved[mskDirectAgentSessionKey(projectId)] || '') : '';
  const license = await mskDirectActiveLicense().catch(() => null);
  // GitHub direto não depende de login separado do painel MSK.
  // A autorização acontece na conta GitHub do próprio cliente e a sessão de
  // escrita nasce somente após o callback oficial do GitHub.
  if (!license) {
    return { ok: false, status: 401, connected: false, code: 'LICENSE_REQUIRED', error: 'Valide sua licença MSK para conectar o GitHub.' };
  }
  const headers = {
    'Content-Type': 'application/json',
    'apikey': config.supabaseAnonKey,
    'Authorization': `Bearer ${license.token}`,
    'x-msk-license': license.token,
    ...(sessionToken ? { 'x-msk-session': sessionToken } : {})
  };
  const timeout = action === 'run' ? 180000 : 30000;
  const functionName = (action === 'connect' || action === 'status' || action === 'bind-existing') ? 'msk-agent-license' : 'msk-agent-public';
  const response = await mskDirectFetchWithTimeout(`${config.supabaseUrl}/functions/v1/${functionName}?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  }, timeout);
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || `Falha HTTP ${response.status}` }; }
  data = mskDirectSanitizeClientError(data, response.status);

  if (projectId && data?.session_token) await chrome.storage.local.set({ [mskDirectAgentSessionKey(projectId)]: data.session_token });
  return { ok: response.ok && data?.code !== 'GITHUB_TEMPORARILY_UNAVAILABLE', status: response.status, ...data };
};
const mskProjectIdFromLovableUrl = value => {
  const text = String(value || '');
  const match = text.match(/\/projects\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i) ||
    text.match(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i);
  return match?.[1] || '';
};

const mskLicenseGithubConnect = async (message = {}, sender = {}) => {
  const license = await mskDirectActiveLicense().catch(() => null);
  if (!license) {
    return { ok: false, connected: false, code: 'LICENSE_REQUIRED', error: 'Valide uma licença MSK ativa para conectar o GitHub.' };
  }

  const payloadIn = message?.payload && typeof message.payload === 'object' ? message.payload : {};
  const senderUrl = String(sender?.tab?.url || message?.origin || payloadIn?.return_url || '');
  const projectId = String(
    payloadIn.lovable_project_id || message?.lovable_project_id || mskProjectIdFromLovableUrl(senderUrl)
  ).trim();
  if (!projectId) {
    return { ok: false, connected: false, code: 'LOVABLE_PROJECT_REQUIRED', error: 'Abra um projeto do Lovable antes de conectar o GitHub.' };
  }

  if (sender?.tab?.id) {
    await chrome.storage.local.set({ [`mskGithubOrigin:${projectId}`]: sender.tab.id }).catch(() => {});
  }

  let repositoryUrl = String(payloadIn.repository_url || payloadIn.repositoryUrl || '').trim();
  if (!repositoryUrl) {
    const saved = await chrome.storage.local.get('mskProjectLinks').catch(() => ({}));
    repositoryUrl = String(saved?.mskProjectLinks?.[projectId]?.repo || '').trim();
  }

  const payload = {
    ...payloadIn,
    lovable_project_id: projectId,
    ...(repositoryUrl ? { repository_url: repositoryUrl } : {}),
    return_url: String(payloadIn.return_url || senderUrl || '').trim()
  };

  const result = await mskDirectAgentApi('connect', payload);
  if (!result?.ok && !result?.authorize_url && !result?.authorization_url && !result?.connected) {
    return result || { ok: false, connected: false, code: 'GITHUB_CONNECT_FAILED', error: 'Não foi possível iniciar a conexão com o GitHub.' };
  }

  const authUrl = String(result?.authorize_url || result?.authorization_url || '').trim();
  if (authUrl) {
    const authTab = await chrome.tabs.create({ url: authUrl, active: true });
    await chrome.storage.local.set({
      mskGithubPendingConnect: {
        projectId,
        originTabId: Number(sender?.tab?.id || 0),
        authTabId: Number(authTab?.id || 0),
        repositoryUrl,
        projectName: String(payloadIn.project_name || ''),
        recoveryState: String(result?.recovery_state || ''),
        createdAt: Date.now()
      }
    }).catch(() => {});
    return { ...result, ok: true, popupOpened: true, authorization_url: authUrl, authorize_url: authUrl, tab_id: Number(authTab?.id || 0) };
  }

  return { ...result, ok: result?.ok !== false, connected: !!result?.connected };
};

globalThis.__MSK_LICENSE_GITHUB_CONNECT__ = mskLicenseGithubConnect;

const mskNormalizeRepoFullName = value => {
  const text = String(value || '').trim();
  const urlMatch = text.match(/https?:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i);
  const candidate = (urlMatch?.[1] || text)
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git(?:[?#].*)?$/i, '')
    .replace(/[?#].*$/, '')
    .replace(/^\/+|\/+$/g, '');
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(candidate) ? candidate : '';
};

const mskFindRepoInLovablePayload = (value, depth = 0, seen = new Set()) => {
  if (depth > 7 || value == null) return '';
  if (typeof value === 'string') return mskNormalizeRepoFullName(value);
  if (typeof value !== 'object') return '';
  if (seen.has(value)) return '';
  seen.add(value);
  const preferredKeys = [
    'repo_full_name','repository_full_name','github_repo_full_name','github_repository',
    'repository','repo','github_repo','github_repository_url','repository_url','github_url','repo_url'
  ];
  for (const key of preferredKeys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      const found = mskFindRepoInLovablePayload(value[key], depth + 1, seen);
      if (found) return found;
    }
  }
  for (const child of Object.values(value)) {
    const found = mskFindRepoInLovablePayload(child, depth + 1, seen);
    if (found) return found;
  }
  return '';
};

const mskResolveLovableProjectRepository = async projectId => {
  const pid = String(projectId || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(pid)) return { ok: false, repository: '' };
  const saved = await chrome.storage.local.get(['mskProjectLinks', 'mskLovableToken']);
  const existing = mskNormalizeRepoFullName(saved?.mskProjectLinks?.[pid]?.repo || '');
  if (existing) return { ok: true, repository: existing, source: 'storage' };

  const lovableToken = String(saved?.mskLovableToken || '').replace(/^Bearer\s+/i, '').trim();
  if (!lovableToken) return { ok: false, repository: '', code: 'LOVABLE_SESSION_MISSING' };

  const candidates = [
    `https://api.lovable.dev/projects/${encodeURIComponent(pid)}`,
    `https://api.lovable.dev/projects/${encodeURIComponent(pid)}/settings`,
  ];
  for (const url of candidates) {
    try {
      const response = await mskDirectFetchWithTimeout(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${lovableToken}`, Accept: 'application/json' },
        credentials: 'omit',
        cache: 'no-store'
      }, 12000);
      if (!response.ok) continue;
      const data = await response.json().catch(() => null);
      const repository = mskFindRepoInLovablePayload(data);
      if (!repository) continue;
      const links = saved?.mskProjectLinks && typeof saved.mskProjectLinks === 'object' ? { ...saved.mskProjectLinks } : {};
      links[pid] = { ...(links[pid] || {}), repo: repository, updatedAt: Date.now(), source: 'lovable-api' };
      await chrome.storage.local.set({ mskProjectLinks: links });
      return { ok: true, repository, source: 'lovable-api' };
    } catch {}
  }
  return { ok: false, repository: '', code: 'LOVABLE_REPOSITORY_NOT_FOUND' };
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'MSK_LOVABLE_PROJECT_REPOSITORY') {
    mskResolveLovableProjectRepository(message?.payload?.lovable_project_id)
      .then(sendResponse)
      .catch(error => sendResponse({ ok: false, repository: '', error: error?.message || 'Falha ao identificar o repositório Lovable.' }));
    return true;
  }

  if (message?.type === 'MSK_GITHUB_EXISTING_INSTALLATION_VISIBLE') {
    (async () => {
      const installationId = Number(message?.installationId || 0);
      if (!installationId) return { ok: false, connected: false };
      const pending = (await chrome.storage.local.get('mskGithubPendingConnect')).mskGithubPendingConnect || null;
      const projectId = String(pending?.projectId || '').trim();
      const originTabId = Number(pending?.originTabId || 0);
      const authTabId = Number(sender?.tab?.id || 0);
      if (!projectId || !originTabId) return { ok: false, connected: false };

      let result = await mskDirectAgentApi('bind-existing', {
        lovable_project_id: projectId,
        installation_id: installationId,
        repository_url: pending?.repositoryUrl || '',
        project_name: pending?.projectName || '',
        recovery_state: pending?.recoveryState || ''
      });
      if (!result?.connected) {
        if (originTabId) chrome.tabs.sendMessage(originTabId, {
          type: 'MSK_DIRECT_AGENT_GITHUB_WAITING',
          projectId,
          error: result?.error || 'Não foi possível confirmar a instalação existente do GitHub.'
        }).catch(() => {});
        return result || { ok: false, connected: false };
      }

      const originTab = await chrome.tabs.get(originTabId).catch(() => null);
      if (originTab) {
        await chrome.tabs.update(originTabId, { active: true }).catch(() => {});
        if (Number.isInteger(originTab.windowId)) await chrome.windows.update(originTab.windowId, { focused: true }).catch(() => {});
      }
      await chrome.storage.local.remove(['mskGithubPendingConnect', `mskGithubOrigin:${projectId}`]);
      setTimeout(() => chrome.tabs.sendMessage(originTabId, {
        type: 'MSK_DIRECT_AGENT_CONNECTED_RETURN',
        projectId,
        recoveredExistingInstallation: true
      }).catch(() => {}), 120);
      if (authTabId && authTabId !== originTabId) setTimeout(() => chrome.tabs.remove(authTabId).catch(() => {}), 450);
      return { ok: true, connected: true, projectId, installationId };
    })().then(sendResponse).catch(error => sendResponse({ ok: false, connected: false, error: error?.message || 'Falha ao reconhecer a instalação GitHub existente.' }));
    return true;
  }

  if (message?.type === 'MSK_DIRECT_AGENT_RETURN_FROM_GITHUB_V2') {
    (async () => {
      const projectId = String(message?.payload?.lovable_project_id || '').trim();
      if (!projectId) return { ok: false, returning: false };
      const key = `mskGithubOrigin:${projectId}`;
      const saved = await chrome.storage.local.get(key);
      const originTabId = Number(saved[key] || 0);
      const currentTabId = Number(sender?.tab?.id || 0);
      if (!originTabId) return { ok: false, returning: false };

      const originTab = await chrome.tabs.get(originTabId).catch(() => null);
      if (!originTab) {
        await chrome.storage.local.remove(key);
        return { ok: false, returning: false };
      }

      await chrome.tabs.update(originTabId, { active: true }).catch(() => {});
      if (Number.isInteger(originTab.windowId)) {
        await chrome.windows.update(originTab.windowId, { focused: true }).catch(() => {});
      }
      await chrome.storage.local.remove(key);

      setTimeout(() => {
        chrome.tabs.sendMessage(originTabId, {
          type: 'MSK_DIRECT_AGENT_CONNECTED_RETURN',
          projectId
        }).catch(() => {});
      }, 180);

      if (currentTabId && currentTabId !== originTabId) {
        setTimeout(() => chrome.tabs.remove(currentTabId).catch(() => {}), 520);
      }

      return { ok: true, returning: true, originTabId };
    })().then(sendResponse).catch(error => sendResponse({
      ok: false,
      returning: false,
      error: error?.message || 'Falha ao retornar para o projeto MSK.'
    }));
    return true;
  }

  const directActions = {
    MSK_DIRECT_AGENT_CONNECT_V2: 'connect',
    MSK_DIRECT_AGENT_STATUS_V2: 'status',
    MSK_DIRECT_AGENT_RUN_V2: 'run'
  };
  const action = directActions[message?.type];
  if (!action) return undefined;

  (async () => {
    if (action === 'connect') {
      return mskLicenseGithubConnect(message, sender);
    }
    return mskDirectAgentApi(action, message.payload || {});
  })().then(sendResponse).catch(error => sendResponse({
    ok: false,
    status: 500,
    error: error?.message || 'Falha no agente MSK.'
  }));
  return true;
});
