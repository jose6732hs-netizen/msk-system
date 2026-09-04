/*! MSK SYSTEM • CÓDIGO PROPRIETÁRIO, ÚNICO E RESTRITO • LICENÇA E INTEGRIDADE VALIDADAS NO SERVIDOR • ALTERAÇÃO NÃO AUTORIZADA BLOQUEIA O USO. */
'use strict';
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
const _0x9a1 = 'https://msksystem.online/api/extension/license-identity';
const _0x9a2 = 'https://iybjfmhqbblrppqoodyf.supabase.co/functions/v1/msk-ai-router';
const _0x9a3 = 'msk-studio-3.4.4-synterolink';
const _0x9a4 = 'MSK System • Projeto proprietário, único e restrito. Reprodução, clonagem ou alteração não autorizada é proibida.';
const _0x9a5 = 'sb_publishable_-aERipV8XmdiDq9UMERZUA_OIyOeyzD';
const _0x9a6 = 5000;
const studioStore = chrome.storage.local;
let studioLicense = null;
let studioLicensePoll = null;
let studioLicenseExpiryTimer = null;
let studioBootstrapped = false;
async function studioStorageGet(keys) {
  return await new Promise(resolve => studioStore.get(keys, resolve));
}
async function studioStorageSet(values) {
  return await new Promise(resolve => studioStore.set(values, resolve));
}
function studioLicenseMessage(code) {
  const map = {
    LICENSE_REQUIRED: 'Ative sua licença no popup da extensão MSK.',
    LICENSE_INVALID: 'A key não foi encontrada ou ainda não foi liberada pelo servidor.',
    LICENSE_EMAIL_MISMATCH: 'O e-mail salvo não corresponde ao proprietário desta key.',
    LICENSE_EXPIRED: 'Sua licença expirou. Ative uma nova key MSK.',
    LICENSE_REVOKED: 'Sua licença foi revogada pelo servidor MSK.',
    LICENSE_BLOCKED: 'Sua licença foi bloqueada pelo servidor MSK.',
    LICENSE_SERVICE_UNAVAILABLE: 'Servidor de licença temporariamente indisponível.',
  };
  return map[String(code || '')] || 'Licença MSK inválida. Ative uma nova key no popup da extensão.';
}
function studioLicenseExpired() {
  if (!studioLicense?.key || !studioLicense?.email) return true;
  if (!studioLicense.expiresAt) return false;
  const ms = Date.parse(String(studioLicense.expiresAt));
  return Number.isFinite(ms) && ms <= Date.now();
}
function setStudioLicenseLocked(locked, message = '') {
  document.body.classList.toggle('msk-license-locked', !!locked);
  const title = document.getElementById('studio-license-title');
  const text = document.getElementById('studio-license-message');
  if (title) title.textContent = locked ? 'MSK Studio bloqueado' : 'Licença ativa';
  if (text && message) text.textContent = message;
}
async function clearStudioLicense(message) {
  studioLicense = null;
  clearTimeout(studioLicenseExpiryTimer);
  await new Promise(resolve => studioStore.remove(['mskLicense', 'mskSession'], resolve));
  setStudioLicenseLocked(true, message || 'Ative uma nova key MSK no popup da extensão.');
}
function scheduleStudioLicenseExpiry() {
  clearTimeout(studioLicenseExpiryTimer);
  if (!studioLicense?.expiresAt) return;
  const expiry = Date.parse(String(studioLicense.expiresAt));
  if (!Number.isFinite(expiry)) return;
  const wait = expiry - Date.now();
  if (wait <= 0) {
    void clearStudioLicense('Sua licença expirou. Ative uma nova key MSK.');
    return;
  }
  studioLicenseExpiryTimer = setTimeout(() => {
    if (studioLicenseExpired()) void clearStudioLicense('Sua licença expirou. Ative uma nova key MSK.');
    else scheduleStudioLicenseExpiry();
  }, Math.min(wait + 100, 2147483000));
}
async function validateStudioLicense({ quiet = true } = {}) {
  if (!studioLicense) {
    const saved = await studioStorageGet(['mskLicense']);
    studioLicense = saved.mskLicense || null;
  }
  if (!studioLicense?.key || !studioLicense?.email) {
    setStudioLicenseLocked(true, 'Ative sua licença usando e-mail + key no popup da extensão MSK.');
    return false;
  }
  if (studioLicenseExpired()) {
    await clearStudioLicense('Sua licença expirou. Ative uma nova key MSK.');
    return false;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(_0x9a1, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${studioLicense.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: studioLicense.email, source: 'msk-system-studio' }),
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok || data?.active !== true) {
      const code = String(data?.code || 'LICENSE_INVALID');
      await clearStudioLicense(studioLicenseMessage(code));
      return false;
    }
    studioLicense = {
      ...studioLicense,
      licenseId: String(data?.license_id || studioLicense.licenseId || ''),
      status: String(data?.status || 'active'),
      activatedAt: data?.activated_at || studioLicense.activatedAt || null,
      expiresAt: data?.expires_at || null,
      checkedAt: Date.now(),
    };
    await studioStorageSet({ mskLicense: studioLicense });
    scheduleStudioLicenseExpiry();
    setStudioLicenseLocked(false);
    return true;
  } catch (error) {
    if (!quiet) setStudioLicenseLocked(true, error?.name === 'AbortError' ? 'Servidor MSK demorou para responder. Tente novamente.' : String(error?.message || 'Falha ao validar licença.'));
    return false;
  } finally {
    clearTimeout(timer);
  }
}
async function getStudioLicenseToken() {
  const ok = await validateStudioLicense({ quiet: false });
  if (!ok || !studioLicense?.key) throw new Error('Licença MSK necessária.');
  return studioLicense.key;
}
function startStudioLicenseWatch() {
  clearInterval(studioLicensePoll);
  studioLicensePoll = setInterval(async () => {
    const ok = await validateStudioLicense({ quiet: true });
    if (ok && !studioBootstrapped) void initStudio();
  }, _0x9a6);
}
window.addEventListener('focus', () => { if (studioLicense) void validateStudioLicense({ quiet: true }); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && studioLicense) void validateStudioLicense({ quiet: true });
});
const DEFAULT_BLANK_HTML = '';
const DEFAULT_TEMPLATES = {
  blank: {
    'index.html': DEFAULT_BLANK_HTML
  },
  landing: {
    'index.html': `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MSK System — Futuro do Desenvolvimento Web com IA</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: #080B11; color: #F8FAFC; overflow-x: hidden; }
    a { color: inherit; text-decoration: none; }
    .navbar { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 16px 36px; background: rgba(11,15,25,0.88); backdrop-filter: blur(16px); border-bottom: 1px solid rgba(139,92,246,0.2); }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 800; font-size: 18px; }
    .brand-icon { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #8B5CF6, #6366F1); display: flex; align-items: center; justify-content: center; font-weight: 900; color: #FFF; box-shadow: 0 4px 14px rgba(139,92,246,0.4); }
    .nav-links { display: flex; align-items: center; gap: 28px; font-size: 13.5px; font-weight: 600; color: #94A3B8; }
    .nav-links a:hover { color: #A78BFA; }
    .nav-cta { padding: 9px 20px; border-radius: 10px; background: linear-gradient(135deg, #8B5CF6, #7C3AED); color: #FFF; font-size: 13px; font-weight: 700; box-shadow: 0 4px 16px rgba(139,92,246,0.35); transition: all 0.2s; }
    .nav-cta:hover { transform: translateY(-2px); box-shadow: 0 6px 22px rgba(139,92,246,0.5); }
    .hero { padding: 90px 24px 60px; text-align: center; max-width: 960px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; }
    .hero-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 18px; border-radius: 9999px; background: rgba(139,92,246,0.12); border: 1px solid rgba(139,92,246,0.3); color: #C084FC; font-size: 12px; font-weight: 700; margin-bottom: 24px; }
    .badge-dot { width: 7px; height: 7px; border-radius: 50%; background: #8B5CF6; box-shadow: 0 0 8px #8B5CF6; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.6; } }
    h1 { font-size: 48px; font-weight: 900; line-height: 1.15; letter-spacing: -1.5px; margin-bottom: 20px; }
    .gradient { background: linear-gradient(135deg, #C084FC 0%, #818CF8 50%, #38BDF8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero p { font-size: 16px; line-height: 1.7; color: #94A3B8; max-width: 680px; margin-bottom: 36px; }
    .btn-group { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; margin-bottom: 50px; }
    .btn-primary { padding: 14px 34px; border-radius: 12px; background: linear-gradient(135deg, #8B5CF6, #6366F1); color: #FFF; font-weight: 800; font-size: 14px; box-shadow: 0 6px 24px rgba(139,92,246,0.4); border: none; cursor: pointer; transition: all 0.25s; font-family: inherit; }
    .btn-primary:hover { transform: translateY(-3px); box-shadow: 0 10px 32px rgba(139,92,246,0.6); }
    .btn-secondary { padding: 14px 30px; border-radius: 12px; background: rgba(30,41,59,0.6); border: 1px solid rgba(148,163,184,0.2); color: #E2E8F0; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.25s; font-family: inherit; }
    .btn-secondary:hover { background: rgba(51,65,85,0.8); }
    .stats-bar { display: flex; justify-content: center; gap: 40px; flex-wrap: wrap; padding: 24px 36px; background: rgba(18,24,38,0.6); border: 1px solid rgba(139,92,246,0.2); border-radius: 16px; backdrop-filter: blur(12px); }
    .stat h4 { font-size: 24px; font-weight: 900; color: #FFF; }
    .stat p { font-size: 12px; color: #94A3B8; font-weight: 600; }
    .section { max-width: 1080px; margin: 0 auto; padding: 70px 24px; }
    .section-header { text-align: center; margin-bottom: 48px; }
    .section-tag { font-size: 11.5px; font-weight: 800; color: #8B5CF6; text-transform: uppercase; letter-spacing: 1px; }
    .section-title { font-size: 32px; font-weight: 900; margin-top: 6px; }
    .grid3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
    .card { background: rgba(18,24,38,0.7); border: 1px solid rgba(139,92,246,0.2); border-radius: 20px; padding: 32px; backdrop-filter: blur(16px); transition: all 0.3s; }
    .card:hover { transform: translateY(-6px); border-color: rgba(139,92,246,0.5); box-shadow: 0 16px 36px rgba(139,92,246,0.2); }
    .card-icon { width: 48px; height: 48px; border-radius: 12px; background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.3); display: flex; align-items: center; justify-content: center; font-size: 22px; margin-bottom: 20px; }
    .card h3 { font-size: 18px; font-weight: 800; margin-bottom: 10px; }
    .card p { font-size: 13.5px; color: #94A3B8; line-height: 1.6; }
    footer { border-top: 1px solid rgba(139,92,246,0.2); padding: 36px 24px; text-align: center; font-size: 12.5px; color: #64748B; background: #06080E; }
    @media (max-width: 768px) { h1 { font-size: 32px; } .nav-links { display: none; } .stats-bar { gap: 20px; } }
  </style>
</head>
<body>
  <header class="navbar">
    <div class="brand">
      <div class="brand-icon">G</div>
      <span>MSK System</span>
    </div>
    <nav class="nav-links">
      <a href="#recursos">Recursos</a>
      <a href="#depoimentos">Depoimentos</a>
      <a href="#precos">Planos</a>
    </nav>
    <a href="https://wa.me/5511943213342?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20MSK%20System" target="_blank" class="nav-cta">Falar no WhatsApp</a>
  </header>
  <main>
    <section class="hero">
      <div class="hero-badge"><span class="badge-dot"></span> MSK Studio Pro 3.0</div>
      <h1>Crie Sites Incríveis com <span class="gradient">Inteligência Artificial</span></h1>
      <p>A plataforma definitiva para desenhar, gerar código e hospedar websites modernos com design glassmorphic e alta conversão.</p>
      <div class="btn-group">
        <button class="btn-primary">Começar Agora</button>
        <button class="btn-secondary">Ver Demonstração</button>
      </div>
      <div class="stats-bar">
        <div class="stat"><h4>+15.000</h4><p>Sites Criados</p></div>
        <div class="stat"><h4>99.9%</h4><p>Uptime</p></div>
        <div class="stat"><h4>4.9 ★</h4><p>Avaliação</p></div>
      </div>
    </section>
    <section id="recursos" class="section">
      <div class="section-header">
        <span class="section-tag">Diferenciais</span>
        <h2 class="section-title">Por que Escolher o MSK Studio?</h2>
      </div>
      <div class="grid3">
        <div class="card"><div class="card-icon">⚡</div><h3>Velocidade Extrema</h3><p>Carregamento instantâneo com código leve e otimizado para máxima conversão.</p></div>
        <div class="card"><div class="card-icon">✨</div><h3>Design Glassmorphic</h3><p>Visual premium com sombras sutis, degradês modernos e tipografia harmônica.</p></div>
        <div class="card"><div class="card-icon">📱</div><h3>100% Responsivo</h3><p>Experiência fluida em qualquer tamanho de tela: Desktop, Tablet e Mobile.</p></div>
      </div>
    </section>
  </main>
  <footer>MSK Studio Pro • © 2026 Todos os direitos reservados</footer>
</body>
</html>`
  },
  dashboard: {
    'index.html': `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MSK Dashboard — Métricas do Sistema</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: #0B0E14; color: #F8FAFC; display: flex; min-height: 100vh; }
    aside { width: 240px; background: #111622; border-right: 1px solid rgba(139,92,246,0.2); padding: 20px; display: flex; flex-direction: column; justify-content: space-between; flex-shrink: 0; }
    .sidebar-logo { font-size: 18px; font-weight: 900; color: #A78BFA; margin-bottom: 28px; }
    nav a { display: block; padding: 10px 14px; border-radius: 10px; font-size: 13.5px; font-weight: 600; color: #94A3B8; margin-bottom: 4px; transition: all 0.2s; }
    nav a:hover { background: rgba(139,92,246,0.1); color: #C084FC; }
    nav a.active { background: rgba(139,92,246,0.2); color: #A78BFA; }
    .sidebar-ver { font-size: 11px; color: #475569; }
    main { flex: 1; padding: 32px; overflow-y: auto; }
    .main-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
    .main-header h1 { font-size: 22px; font-weight: 800; }
    .btn-export { padding: 9px 18px; background: linear-gradient(135deg, #8B5CF6, #6366F1); color: #FFF; border: none; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; box-shadow: 0 4px 14px rgba(139,92,246,0.35); }
    .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 28px; }
    .metric-card { background: #111622; border: 1px solid rgba(139,92,246,0.2); border-radius: 16px; padding: 24px; }
    .metric-label { font-size: 11.5px; color: #94A3B8; font-weight: 600; }
    .metric-value { font-size: 28px; font-weight: 900; margin-top: 8px; }
    .metric-value.purple { color: #A78BFA; }
    .metric-value.cyan { color: #38BDF8; }
    .metric-value.green { color: #34D399; }
    .metric-trend { font-size: 11px; color: #34D399; font-weight: 700; margin-top: 6px; }
    .activity-card { background: #111622; border: 1px solid rgba(139,92,246,0.2); border-radius: 16px; padding: 24px; }
    .activity-title { font-size: 15px; font-weight: 800; margin-bottom: 16px; }
    .activity-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(139,92,246,0.1); }
    .activity-item:last-child { border: none; }
    .act-dot { width: 8px; height: 8px; border-radius: 50%; background: #8B5CF6; margin-right: 12px; flex-shrink: 0; }
    .act-info { display: flex; align-items: center; }
    .act-name { font-size: 13px; font-weight: 600; }
    .act-time { font-size: 11px; color: #64748B; }
    .act-amount { font-size: 13px; font-weight: 700; color: #34D399; }
  </style>
</head>
<body>
  <aside>
    <div>
      <div class="sidebar-logo">⚡ MSK</div>
      <nav>
        <a href="#" class="active">Visão Geral</a>
        <a href="#">Usuários</a>
        <a href="#">Vendas</a>
        <a href="#">Relatórios</a>
        <a href="#">Configurações</a>
      </nav>
    </div>
    <div class="sidebar-ver">v3.0.0 • MSK Pro</div>
  </aside>
  <main>
    <div class="main-header">
      <h1>Métricas do Sistema</h1>
      <button class="btn-export">+ Exportar Relatório</button>
    </div>
    <div class="grid3">
      <div class="metric-card">
        <div class="metric-label">Receita Total</div>
        <div class="metric-value purple">R$ 48.920</div>
        <div class="metric-trend">↑ +18.4% este mês</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Assinantes Ativos</div>
        <div class="metric-value green">1.482</div>
        <div class="metric-trend">↑ +12 novos hoje</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Taxa de Conversão</div>
        <div class="metric-value cyan">4.8%</div>
        <div class="metric-trend">↑ +0.6% vs ontem</div>
      </div>
    </div>
    <div class="activity-card">
      <div class="activity-title">Atividade Recente</div>
      <div class="activity-item"><div class="act-info"><span class="act-dot"></span><div><div class="act-name">Maria Oliveira</div><div class="act-time">há 3 minutos</div></div></div><span class="act-amount">+ R$ 297,00</span></div>
      <div class="activity-item"><div class="act-info"><span class="act-dot"></span><div><div class="act-name">Carlos Silva</div><div class="act-time">há 18 minutos</div></div></div><span class="act-amount">+ R$ 99,00</span></div>
      <div class="activity-item"><div class="act-info"><span class="act-dot"></span><div><div class="act-name">Ana Beatriz</div><div class="act-time">há 42 minutos</div></div></div><span class="act-amount">+ R$ 197,00</span></div>
    </div>
  </main>
</body>
</html>`
  }
};
const state = {
  projects: [],
  currentProjectId: null,
  activeFile: 'index.html',
  isGenerating: false,
  selectedRole: 'auto',
  theme: 'dark',
  currentDevice: 'desktop',
  aiCatalog: [],
  aiModelByProvider: {},
  selectedProvider: '',
  selectedModel: ''
};
const $ = (id) => document.getElementById(id);
const projectSelector = $('project-selector');
const btnNewProject   = $('btn-new-project');
const modalNewProject = $('modal-new-project');
const modalClose      = $('modal-new-project-close');
const btnConfirmCreate= $('btn-confirm-create-project');
const newProjNameInput= $('new-proj-name');
const tabBtnPreview   = $('tab-btn-preview');
const tabBtnCode      = $('tab-btn-code');
const tabBtnFiles     = $('tab-btn-files');
const tabBtnCheckpts  = $('tab-btn-checkpoints');
const viewPreview     = $('view-preview');
const viewCode        = $('view-code');
const viewFiles       = $('view-files');
const viewCheckpoints = $('view-checkpoints');
const livePreviewFrame= $('live-preview-frame');
const previewEmptyState= $('preview-empty-state');
const previewWrapper  = $('preview-wrapper');
const btnViewDesktop  = $('btn-view-desktop');
const btnViewTablet   = $('btn-view-tablet');
const btnViewMobile   = $('btn-view-mobile');
const btnReloadPreview= $('btn-reload-preview');
const btnOpenExternal = $('btn-open-external');
const btnEmptyStartChat=$('btn-empty-start-chat');
const previewUrlBadge = $('preview-url-badge');
const codeTextarea    = $('code-editor-textarea');
const editorFileTabs  = $('editor-file-tabs');
const codeEditorGutter= $('code-editor-gutter');
const editorLangTag   = $('editor-lang-tag');
const editorSizeTag   = $('editor-size-tag');
const btnSaveCode     = $('btn-save-code');
const filesTreeList   = $('files-tree-list');
const filesProjectBadge=$('files-project-badge');
const btnAddFile      = $('btn-add-file');
const checkpointsList = $('checkpoints-timeline');
const btnManualCheckpt= $('btn-create-manual-checkpoint');
const studioChatInput = $('studio-chat-input');
const btnSendPrompt   = $('btn-send-studio-prompt');
const studioMessages  = $('studio-messages-list');
const aiStatusBox     = $('ai-generating-status');
const aiStatusLabel   = $('ai-status-label');
const aiStatusFile    = $('ai-status-file');
const btnDownloadZip  = $('btn-download-zip');
const themeToggle     = $('theme-toggle');
const themeSunBox     = $('theme-sun-box');
const themeMoonBox    = $('theme-moon-box');
const agentPillsGroup = $('agent-pills-group');
const agentActiveBadge= $('agent-active-badge');
const aiProviderSelect= $('ai-provider-select');
const aiModelSelect   = $('ai-model-select');
const activeRoutingBadge=$('active-routing-badge');
async function initStudio() {
  if (!(await _0x9a7())) { setStudioLicenseLocked(true, 'Integridade MSK inválida. Reinstale a extensão oficial.'); return; }
  aiStatusBox?.classList?.add('hidden');
  startStudioLicenseWatch();
  setStudioLicenseLocked(true, 'Verificando sua licença no servidor MSK...');
  const licensed = await validateStudioLicense({ quiet: false });
  if (!licensed) return;
  if (studioBootstrapped) return;
  studioBootstrapped = true;
  const saved = await new Promise(r => chrome.storage.local.get(['studio_projects_v5', 'studio_current_id_v5', 'theme'], r));
  applyTheme(saved.theme || 'dark');
  state.aiModelByProvider = {};
  if (saved.studio_projects_v5 && saved.studio_projects_v5.length > 0) {
    state.projects = saved.studio_projects_v5;
    state.currentProjectId = saved.studio_current_id_v5 || state.projects[0].id;
  } else {
    const defaultProj = {
      id: 'proj_' + Date.now().toString(36),
      name: 'Meu Projeto',
      files: { ...DEFAULT_TEMPLATES.blank },
      checkpoints: [
        { id: 'chk_init', date: new Date().toISOString(), reason: 'Projeto Inicial Criado', filesCount: 1 }
      ],
      chatHistory: []
    };
    state.projects = [defaultProj];
    state.currentProjectId = defaultProj.id;
    saveProjects();
  }
  renderProjectSelector();
  loadCurrentProject();
  setupAgentPills();
  setupEmptyStateBtn();
  setupProviderSelect();
  setupViewportSwitcher();
}
function saveProjects() {
  state.projects.forEach(p => {
    if (p.checkpoints && p.checkpoints.length > 15) {
      p.checkpoints = p.checkpoints.slice(0, 15);
    }
  });
  chrome.storage.local.set({
    studio_projects_v5: state.projects,
    studio_current_id_v5: state.currentProjectId
  });
}
function getCurrentProject() {
  return state.projects.find(p => p.id === state.currentProjectId) || state.projects[0];
}
function setupAgentPills() {
  const roleLabels = {
    auto: 'Auto (Inteligente)',
    builder: 'Builder (Estrutura)',
    designer: 'Designer (UI/UX)',
    debugger: 'Debugger (Correção)',
    fullstack: 'Full Stack (Geral)'
  };
  agentPillsGroup?.querySelectorAll('.agent-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      agentPillsGroup.querySelectorAll('.agent-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const role = pill.getAttribute('data-role') || 'auto';
      state.selectedRole = role;
      if (agentActiveBadge) {
        agentActiveBadge.textContent = roleLabels[role] || role;
      }
    });
  });
}
function _0x9a8() {
  // Modelos liberados pelo Super Admin ficam disponíveis para escolha na extensão.
  window.MSKModels?.attach({
    providerSelect: aiProviderSelect,
    modelSelect: aiModelSelect,
    onChange: (sel) => {
      state.selectedProvider = sel.provider;
      state.selectedModel = sel.model;
      const tag = document.getElementById('header-ai-model-tag');
      if (tag) tag.textContent = sel.model ? sel.label : 'IA MSK Pronta';
      if (activeRoutingBadge) {
        activeRoutingBadge.textContent = sel.model
          ? `${window.MSKModels.providerLabel(sel.provider)} • ${sel.label}`
          : 'Nenhum modelo liberado no Admin';
      }
    },
  });
}
function _0x9a9() { _0x9a8(); }
async function _0x9a7() {
  try { return !!window.__MSK_GUARD_PROMISE__ && (await window.__MSK_GUARD_PROMISE__) === true; }
  catch { return false; }
}
async function _0x9aa() { _0x9a8(); return true; }
function setupProviderSelect() {
  if (activeRoutingBadge) activeRoutingBadge.style.color = 'var(--brand-success)';
  _0x9a8();
}
function setupEmptyStateBtn() {
  btnEmptyStartChat?.addEventListener('click', () => {
    studioChatInput?.focus();
  });
}
function setupViewportSwitcher() {
  btnViewDesktop?.addEventListener('click', () => applyDeviceMode('desktop', btnViewDesktop));
  btnViewTablet?.addEventListener('click', () => applyDeviceMode('tablet', btnViewTablet));
  btnViewMobile?.addEventListener('click', () => applyDeviceMode('mobile', btnViewMobile));
}
function applyDeviceMode(mode, targetBtn) {
  state.currentDevice = mode;
  [btnViewDesktop, btnViewTablet, btnViewMobile].forEach(b => b?.classList.remove('active'));
  targetBtn?.classList.add('active');
  if (previewWrapper) {
    previewWrapper.className = 'preview-frame-wrapper ' + (mode === 'desktop' ? '' : mode);
  }
  const proj = getCurrentProject();
  const projName = proj ? proj.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'meu-projeto';
  const labelMap = {
    desktop: 'Desktop (100%)',
    tablet: 'Tablet (768px)',
    mobile: 'Mobile (375px)'
  };
  if (previewUrlBadge) {
    previewUrlBadge.textContent = `live-sandbox://${projName}/index.html • ${labelMap[mode] || mode}`;
  }
}
function renderProjectSelector() {
  projectSelector.innerHTML = state.projects.map(p => `
    <option value="${p.id}" ${p.id === state.currentProjectId ? 'selected' : ''}>${escapeHtml(p.name)}</option>
  `).join('');
}
projectSelector.addEventListener('change', (e) => {
  state.currentProjectId = e.target.value;
  saveProjects();
  loadCurrentProject();
  toast('Projeto carregado!', 1500);
});
function loadCurrentProject() {
  const proj = getCurrentProject();
  if (!proj) return;
  state.activeFile = Object.keys(proj.files)[0] || 'index.html';
  renderLivePreview();
  renderEditorTabs();
  renderFilesTree();
  renderCheckpointsTimeline();
  renderProjectChatHistory();
}
function renderProjectChatHistory() {
  const proj = getCurrentProject();
  if (!proj) return;
  studioMessages.innerHTML = '';
  if (!proj.chatHistory || proj.chatHistory.length === 0) {
    studioMessages.innerHTML = `
      <div class="chat-system-welcome">
        <div class="welcome-icon-box">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <h3>MSK Studio — Pronto para Criar</h3>
        <p>Digite no campo abaixo o que você deseja criar. A Inteligência Artificial construirá sua página ao vivo em tempo real.</p>
      </div>
    `;
    return;
  }
  proj.chatHistory.forEach(msg => {
    renderChatMessageDom(msg.role, msg.content, msg.meta);
  });
}
function renderLivePreview() {
  const proj = getCurrentProject();
  if (!proj) return;
  let htmlContent = (proj.files['index.html'] || '').trim();
  const hasTailwindCDN = htmlContent.includes('cdn.tailwindcss.com');
  const hasTailwindClasses = (htmlContent.includes('bg-[#') || htmlContent.includes('text-slate-')) && !htmlContent.includes('background: #080B11');
  const isOldBrokenTemplate = hasTailwindCDN || hasTailwindClasses;
  const isBlank = !htmlContent ||
                  htmlContent === '' ||
                  htmlContent === '<!DOCTYPE html><html><body></body></html>' ||
                  htmlContent.includes('Canvas limpo pronto') ||
                  isOldBrokenTemplate;
  if (isBlank) {
    if (isOldBrokenTemplate && htmlContent.length > 50) {
      proj.files['index.html'] = '';
      proj.files['styles.css'] = '';
      proj.files['script.js'] = '';
      saveProjects();
    }
    previewEmptyState?.classList.remove('hidden');
    livePreviewFrame?.classList.add('hidden');
  } else {
    previewEmptyState?.classList.add('hidden');
    if (livePreviewFrame) {
      livePreviewFrame.classList.remove('hidden');
      if (proj.files['styles.css']) {
        const injectedCss = `<style id="msk-injected-styles">\n${proj.files['styles.css']}\n</style>`;
        if (htmlContent.includes('</head>')) {
          htmlContent = htmlContent.replace('</head>', `${injectedCss}\n</head>`);
        } else {
          htmlContent = injectedCss + htmlContent;
        }
      }
      livePreviewFrame.srcdoc = htmlContent;
      try {
        if (livePreviewFrame.contentDocument) {
          livePreviewFrame.contentDocument.open();
          livePreviewFrame.contentDocument.write(htmlContent);
          livePreviewFrame.contentDocument.close();
        }
      } catch (_) {}
    }
  }
}
btnReloadPreview?.addEventListener('click', () => {
  renderLivePreview();
  toast('Preview recarregado!', 1500);
});
btnOpenExternal?.addEventListener('click', () => {
  const proj = getCurrentProject();
  const content = proj.files['index.html'] || '<!DOCTYPE html><html><body><h1>MSK Studio Sandbox</h1></body></html>';
  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
});
function renderEditorTabs() {
  const proj = getCurrentProject();
  if (!proj) return;
  const files = Object.keys(proj.files);
  editorFileTabs.innerHTML = files.map(file => {
    const ext = file.split('.').pop().toLowerCase();
    return `
      <button class="editor-tab ${file === state.activeFile ? 'active' : ''}" data-filename="${file}">
        <span class="file-badge-ext ext-${ext}">${ext}</span>
        <span>${file}</span>
      </button>
    `;
  }).join('');
  editorFileTabs.querySelectorAll('.editor-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.activeFile = tab.getAttribute('data-filename');
      renderEditorTabs();
      loadCodeToEditor();
    });
  });
  loadCodeToEditor();
}
function loadCodeToEditor() {
  const proj = getCurrentProject();
  if (!proj) return;
  const content = proj.files[state.activeFile] || '';
  if (codeTextarea) {
    codeTextarea.value = content;
    updateEditorStats(content);
  }
}
function updateEditorStats(content) {
  const lines = content.split('\n').length;
  const chars = content.length;
  const ext = (state.activeFile.split('.').pop() || 'TXT').toUpperCase();
  if (editorLangTag) editorLangTag.textContent = ext;
  if (editorSizeTag) editorSizeTag.textContent = `${lines} linhas • ${(chars / 1024).toFixed(1)} KB`;
  if (codeEditorGutter) {
    let gutterStr = '';
    for (let i = 1; i <= lines; i++) {
      gutterStr += i + '\n';
    }
    codeEditorGutter.textContent = gutterStr;
  }
}
codeTextarea?.addEventListener('input', () => {
  const proj = getCurrentProject();
  if (!proj) return;
  const content = codeTextarea.value;
  proj.files[state.activeFile] = content;
  updateEditorStats(content);
  saveProjects();
  if (state.activeFile === 'index.html') {
    renderLivePreview();
  }
});
codeTextarea?.addEventListener('scroll', () => {
  if (codeEditorGutter) {
    codeEditorGutter.scrollTop = codeTextarea.scrollTop;
  }
});
codeTextarea?.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveCurrentCode();
  }
});
btnSaveCode?.addEventListener('click', saveCurrentCode);
function saveCurrentCode() {
  const proj = getCurrentProject();
  if (!proj) return;
  proj.files[state.activeFile] = codeTextarea.value;
  saveProjects();
  renderLivePreview();
  toast('✓ Arquivo salvo com sucesso!', 1500);
}
function renderFilesTree() {
  const proj = getCurrentProject();
  if (!proj) return;
  const files = Object.keys(proj.files);
  let totalBytes = 0;
  filesTreeList.innerHTML = files.map(file => {
    const content = proj.files[file] || '';
    const sizeKb = (content.length / 1024).toFixed(1);
    totalBytes += content.length;
    const ext = file.split('.').pop().toLowerCase();
    return `
      <div class="file-tree-item" data-filename="${file}">
        <div class="file-info">
          <span class="file-badge-ext ext-${ext}">${ext}</span>
          <strong>${file}</strong>
        </div>
        <div class="file-meta-right">
          <span class="file-size-tag">${sizeKb} KB</span>
          ${file !== 'index.html' ? `<button class="btn-del-file" data-filename="${file}" title="Excluir arquivo">✕</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
  if (filesProjectBadge) {
    filesProjectBadge.textContent = `${files.length} arquivo(s) • ${(totalBytes / 1024).toFixed(1)} KB total`;
  }
  filesTreeList.querySelectorAll('.file-tree-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-del-file')) return;
      state.activeFile = item.getAttribute('data-filename');
      switchView('code');
    });
  });
  filesTreeList.querySelectorAll('.btn-del-file').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const fn = btn.getAttribute('data-filename');
      if (confirm(`Deseja excluir o arquivo "${fn}"?`)) {
        delete proj.files[fn];
        saveProjects();
        loadCurrentProject();
      }
    });
  });
}
btnAddFile?.addEventListener('click', () => {
  const name = prompt('Nome do novo arquivo (Ex: styles.css ou app.js):');
  if (!name) return;
  const proj = getCurrentProject();
  if (proj.files[name]) {
    alert('Arquivo já existe!');
    return;
  }
  proj.files[name] = '';
  state.activeFile = name;
  saveProjects();
  loadCurrentProject();
  switchView('code');
});
function createCheckpoint(reason = 'Alteração pela IA') {
  const proj = getCurrentProject();
  if (!proj) return;
  if (!proj.checkpoints) proj.checkpoints = [];
  const filesCount = Object.keys(proj.files).length;
  proj.checkpoints.unshift({
    id: 'chk_' + Date.now().toString(36),
    date: new Date().toISOString(),
    reason: reason,
    filesCount: filesCount,
    snapshot: JSON.parse(JSON.stringify(proj.files))
  });
  if (proj.checkpoints.length > 15) proj.checkpoints = proj.checkpoints.slice(0, 15);
  saveProjects();
  renderCheckpointsTimeline();
}
btnManualCheckpt?.addEventListener('click', () => {
  createCheckpoint('Snapshot manual criado pelo usuário');
  toast('✓ Snapshot manual criado!', 1500);
});
function renderCheckpointsTimeline() {
  const proj = getCurrentProject();
  if (!proj || !proj.checkpoints) return;
  checkpointsList.innerHTML = proj.checkpoints.map(c => `
    <div class="checkpoint-card">
      <div class="checkpoint-info">
        <span class="checkpoint-time">${new Date(c.date).toLocaleTimeString('pt-BR')} • ${c.filesCount || 1} arquivo(s)</span>
        <span class="checkpoint-desc">${escapeHtml(c.reason)}</span>
      </div>
      <button class="btn-restore-checkpoint" data-id="${c.id}">Restaurar</button>
    </div>
  `).join('');
  checkpointsList.querySelectorAll('.btn-restore-checkpoint').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const chk = proj.checkpoints.find(c => c.id === id);
      if (chk && chk.snapshot) {
        if (confirm(`Deseja restaurar o projeto para o ponto "${chk.reason}"?`)) {
          proj.files = JSON.parse(JSON.stringify(chk.snapshot));
          saveProjects();
          loadCurrentProject();
          toast('✓ Versão anterior restaurada com sucesso!', 2000);
        }
      }
    });
  });
}
btnDownloadZip?.addEventListener('click', async () => {
  const proj = getCurrentProject();
  if (!proj) return;
  toast('Gerando arquivo ZIP...', 0);
  try {
    const zip = new JSZip();
    for (const [name, content] of Object.entries(proj.files)) {
      zip.file(name, content);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${proj.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    toast('✓ ZIP baixado com sucesso!', 3000);
  } catch (e) {
    toast('Erro ao gerar ZIP: ' + e.message, 3000);
  }
});
tabBtnPreview?.addEventListener('click', () => switchView('preview'));
tabBtnCode?.addEventListener('click', () => switchView('code'));
tabBtnFiles?.addEventListener('click', () => switchView('files'));
tabBtnCheckpts?.addEventListener('click', () => switchView('checkpoints'));
function switchView(viewName) {
  [tabBtnPreview, tabBtnCode, tabBtnFiles, tabBtnCheckpts].forEach(t => t?.classList.remove('active'));
  [viewPreview, viewCode, viewFiles, viewCheckpoints].forEach(v => v?.classList.remove('active'));
  if (viewName === 'preview') {
    tabBtnPreview?.classList.add('active');
    viewPreview?.classList.add('active');
    renderLivePreview();
  } else if (viewName === 'code') {
    tabBtnCode?.classList.add('active');
    viewCode?.classList.add('active');
    renderEditorTabs();
  } else if (viewName === 'files') {
    tabBtnFiles?.classList.add('active');
    viewFiles?.classList.add('active');
    renderFilesTree();
  } else if (viewName === 'checkpoints') {
    tabBtnCheckpts?.classList.add('active');
    viewCheckpoints?.classList.add('active');
    renderCheckpointsTimeline();
  }
}
document.querySelectorAll('.studio-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    studioChatInput.value = chip.getAttribute('data-prompt');
    studioChatInput.focus();
  });
});
studioChatInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!state.isGenerating) submitAIPrompt();
  }
});
btnSendPrompt?.addEventListener('click', () => {
  if (!state.isGenerating) submitAIPrompt();
});
function updateProgress(mainText, subText = '') {
  if (aiStatusLabel) aiStatusLabel.textContent = mainText;
  if (aiStatusFile) aiStatusFile.textContent = subText;
}
function normalizeAIFileMap(value) {
  if (Array.isArray(value)) {
    const out = {};
    for (const item of value) {
      const path = String(item?.path || item?.file || item?.filename || item?.name || '').trim();
      const content = item?.content;
      if (path && typeof content === 'string') out[path] = content;
    }
    return out;
  }
  return value && typeof value === 'object' ? value : {};
}
function parseAIJson(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    const error = new Error('A resposta da IA retornou vazia.');
    error.code = 'AI_EMPTY_RESPONSE';
    throw error;
  }
  const clean = rawText
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  const candidates = [clean];
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(clean.slice(firstBrace, lastBrace + 1));
  for (const candidate of [...new Set(candidates)]) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }
  const error = new Error('A resposta da IA foi truncada antes de fechar o JSON. O MSK tentará novamente automaticamente.');
  error.code = 'AI_JSON_INCOMPLETE';
  throw error;
}
function validateAndExtractAIResponse(rawText) {
  const parsed = parseAIJson(rawText);
  const files = normalizeAIFileMap(parsed.files);
  if (Object.keys(files).length === 0) {
    const error = new Error('A IA respondeu sem nenhum arquivo alterado.');
    error.code = 'AI_NO_FILES';
    throw error;
  }
  for (const [filename, content] of Object.entries(files)) {
    if (typeof content !== 'string') {
      throw new Error(`Arquivo "${filename}" com formato inválido.`);
    }
    if (filename.endsWith('.html')) {
      if ((content.includes('<html') && !content.includes('</html>')) || (content.includes('<body') && !content.includes('</body>'))) {
        const error = new Error(`Arquivo "${filename}" parece truncado.`);
        error.code = 'AI_JSON_INCOMPLETE';
        throw error;
      }
    }
  }
  return {
    summary: parsed.summary || 'Código construído e sincronizado com sucesso.',
    files
  };
}
function rankStudioFiles(files, prompt, limit = 16) {
  const terms = [...new Set(String(prompt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9_.-]+/)
    .filter(term => term.length >= 3))];
  const normalizedPrompt = String(prompt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const visual = /\b(cor|color|fundo|background|tema|theme|css|estilo|style|layout|botao|button|card|menu|header|footer|fonte)\b/i.test(normalizedPrompt);
  const copy = /\b(texto|text|copy|titulo|title|subtitulo|descricao|headline|label|nome)\b/i.test(normalizedPrompt);
  return Object.entries(files)
    .filter(([path]) => !/(^|\/)(node_modules|dist|build|coverage|\.git)(\/|$)/i.test(path))
    .map(([path, content]) => {
      const lower = path.toLowerCase();
      let score = 0;
      for (const term of terms) if (lower.includes(term)) score += term.length >= 6 ? 12 : 6;
      if (/\.(tsx?|jsx?|css|scss|html)$/i.test(path)) score += 3;
      if (/(index|home|app|main|style|global|theme|layout)/i.test(lower)) score += 3;
      if (visual && /\.(css|scss)$/i.test(path)) score += 30;
      if (visual && /(style|theme|layout|header|footer|button|card|app|home)/i.test(lower)) score += 12;
      if (copy && /(home|index|landing|hero|header|content|page|route|component)/i.test(lower)) score += 14;
      return { path, content, score };
    })
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
}
function buildStudioFileContext(files, prompt, attempt = 0) {
  const limit = attempt === 0 ? 16 : attempt === 1 ? 11 : 8;
  const maxChars = attempt === 0 ? 145000 : attempt === 1 ? 105000 : 80000;
  const ranked = rankStudioFiles(files, prompt, limit);
  let used = 0;
  const parts = [];
  for (const item of ranked) {
    const remaining = maxChars - used;
    if (remaining <= 1000) break;
    const body = String(item.content || '').slice(0, Math.min(28000, remaining));
    used += body.length;
    parts.push(`=== FILE: ${item.path} ===\n${body}\n=== END FILE ===`);
  }
  const pathList = Object.keys(files).slice(0, 320).join('\n');
  return { context: parts.join('\n\n'), pathList };
}
async function submitAIPrompt() {
  if (state.isGenerating) return;
  const prompt = studioChatInput.value.trim();
  if (!prompt) return;
  const proj = getCurrentProject();
  if (!proj) return;
  state.isGenerating = true;
  if (btnSendPrompt) {
    btnSendPrompt.disabled = true;
    btnSendPrompt.style.opacity = '0.6';
  }
  addChatMessage('user', prompt);
  studioChatInput.value = '';
  createCheckpoint(`Prompt: "${prompt.substring(0, 32)}..."`);
  aiStatusBox?.classList.remove('hidden');
  updateProgress('Analisando sua solicitação...', 'Identificando escopo e arquivos');
  try {
    const provider = 'msk-auto';
    const role = state.selectedRole || 'auto';
    const currentFiles = proj.files;
    updateProgress('Iniciando construção com IA...', `Motor: ${provider} • Papel: ${role}`);
    const response = await executeAIAgent(provider, role, prompt, currentFiles, updateProgress);
    if (response.ok && response.files && Object.keys(response.files).length > 0) {
      updateProgress('Aplicando alterações...', `${Object.keys(response.files).length} arquivo(s) gerados`);
      for (const [fileName, fileContent] of Object.entries(response.files)) {
        proj.files[fileName] = fileContent;
      }
      saveProjects();
      updateProgress('Atualizando Live Preview e Editor...', 'Sincronizando');
      renderLivePreview();
      renderEditorTabs();
      renderFilesTree();
      const meta = {
        providerUsed: response.providerUsed || 'MSK Auto',
        model: response.model || '',
        role: role,
        time: new Date().toLocaleTimeString('pt-BR')
      };
      addChatMessage('assistant', {
        summary: response.summary || 'Código construído e sincronizado com sucesso.',
        files: Object.keys(response.files)
      }, meta);
      toast('✓ Alterações aplicadas na prévia ao vivo!', 2500);
    }
  } catch (e) {
    addChatMessage('assistant', {
      error: 'Aviso: ' + (e.message || 'Seu projeto foi preservado.')
    });
    toast('Projeto preservado.', 3500);
    studioChatInput.value = prompt;
  } finally {
    state.isGenerating = false;
    if (btnSendPrompt) {
      btnSendPrompt.disabled = false;
      btnSendPrompt.style.opacity = '1';
    }
    aiStatusBox?.classList.add('hidden');
  }
}
function addChatMessage(role, content, meta = null) {
  const proj = getCurrentProject();
  if (!proj.chatHistory) proj.chatHistory = [];
  proj.chatHistory.push({ role, content, meta });
  if (proj.chatHistory.length > 30) proj.chatHistory.shift();
  saveProjects();
  renderChatMessageDom(role, content, meta);
}
function renderChatMessageDom(role, content, meta) {
  const welcome = studioMessages.querySelector('.chat-system-welcome');
  if (welcome) welcome.remove();
  const div = document.createElement('div');
  div.className = `studio-msg ${role}`;
  if (role === 'user') {
    div.innerHTML = `<div class="msg-bubble">${escapeHtml(content)}</div>`;
  } else {
    let body = '';
    if (content.error) {
      body = `<div style="color:var(--brand-danger);font-weight:600;font-size:11.5px;line-height:1.5;">${escapeHtml(content.error)}</div>`;
    } else {
      const providerLabel = meta?.providerUsed || 'MSK Auto';
      const timeStr = meta?.time || '';
      body = `
        <div class="msg-meta-bar">
          <span class="msg-provider-tag">⚡ ${escapeHtml(providerLabel)}</span>
          <span class="msg-time-tag">${escapeHtml(timeStr)}</span>
        </div>
        <div class="msg-summary">${escapeHtml(content.summary)}</div>
        ${content.files?.length ? `
          <div class="msg-diff-files">
            ${content.files.map(f => `<span class="msg-diff-tag">✓ ${escapeHtml(f)}</span>`).join('')}
          </div>
        ` : ''}
      `;
    }
    div.innerHTML = `<div class="msg-bubble">${body}</div>`;
  }
  studioMessages.appendChild(div);
  studioMessages.scrollTop = studioMessages.scrollHeight;
}
async function executeAIAgent(provider, role, prompt, files, onProgress = () => {}) {
  if (!(await _0x9a7())) throw new Error('Integridade MSK inválida. Reinstale a extensão oficial.');
  const accessToken = await getStudioLicenseToken();
  const { context: fileContext, pathList } = buildStudioFileContext(files, prompt, 0);
  const SYSTEM_PROMPT = `Você é o MSK Studio Pro, módulo oficial do MSK System, integrado ao MSK SaaS. Seu papel atual é ${role}.
Analise os arquivos fornecidos e faça somente as alterações necessárias, preservando tudo que já funciona.
Use EXATAMENTE os caminhos existentes listados abaixo. Não invente index.html/styles.css se esses caminhos não existirem.
Retorne SOMENTE os arquivos que realmente precisaram ser modificados.
Responda EXCLUSIVAMENTE com JSON válido neste formato:
{
  "summary": "Resumo conciso das alterações em português",
  "files": {
    "caminho/exato/do/arquivo.ext": "conteúdo COMPLETO atualizado do arquivo"
  }
}
Não use markdown, comentários fora do JSON nem texto depois do fechamento do objeto. Cada arquivo alterado deve vir COMPLETO.
CAMINHOS DO PROJETO:
${pathList}`;
  onProgress('Conectando ao MSK SaaS...', state.selectedModel ? `Modelo selecionado: ${state.selectedModel}` : 'Usando a IA ativa definida no Super Admin');
  const response = await fetch(_0x9a2, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': _0x9a5,
      'Content-Type': 'application/json',
      'x-msk-build': _0x9a3,
    },
    body: JSON.stringify({
      action: 'editor-chat',
      routing_mode: state.selectedModel ? 'explicit' : 'active',
      provider: state.selectedProvider || undefined,
      model: state.selectedModel || undefined,
      source: 'msk-system-studio',
      license_email: studioLicense?.email || '',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${prompt}

CONTEÚDO DOS ARQUIVOS MAIS RELEVANTES:
${fileContext}` },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 18000,
      temperature: 0,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(data?.code || data?.error?.code || '');
    if (response.status === 401 || response.status === 403 || ['LICENSE_INVALID','LICENSE_EMAIL_MISMATCH','LICENSE_EXPIRED','LICENSE_REVOKED','LICENSE_BLOCKED'].includes(code)) {
      await clearStudioLicense(studioLicenseMessage(code || 'LICENSE_INVALID'));
    }
    const message = typeof data?.error === 'string' ? data.error : data?.error?.message || data?.message || `MSK SaaS respondeu HTTP ${response.status}`;
    const err = new Error(message); err.code = code; throw err;
  }
  const rawText = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!rawText) throw new Error('A IA ativa no MSK respondeu sem conteúdo.');
  const validated = validateAndExtractAIResponse(rawText);
  return {
    ok: true,
    providerUsed: `${data?.provider || 'IA ativa MSK'}${data?.model ? ` • ${data.model}` : ''}`,
    model: data?.model || '',
    summary: validated.summary,
    files: validated.files,
  };
}
function generateAutonomousCode(prompt, currentFiles, role = 'auto') {
  const p = prompt.toLowerCase();
  let existingHtml = currentFiles['index.html'] || '';
  const resultFiles = { ...currentFiles };
  const hasTailwindCDN = existingHtml.includes('cdn.tailwindcss.com');
  const hasTailwindClasses = (existingHtml.includes('bg-[#') || existingHtml.includes('text-slate-')) && !existingHtml.includes('background: #080B11');
  const hasLegacyTemplate = existingHtml.includes('Soluções Digitais de Alta Performance') && !existingHtml.includes('background: #080B11');
  const isExplicitNewSite = (
    p.includes('crie um site') || p.includes('criar um site') || p.includes('crie um novo site') ||
    p.includes('novo site') || p.includes('nova landing page') || p.includes('crie uma landing page') ||
    p.includes('criar landing page') || p.includes('crie uma pagina') || p.includes('criar pagina') ||
    p.includes('create a website') || p.includes('build a website') || p.includes('recomece') || p.includes('do zero')
  );
  const isBlank = !existingHtml || existingHtml.length < 50 || existingHtml.includes('Canvas limpo pronto') || hasTailwindCDN || hasTailwindClasses || hasLegacyTemplate || (isExplicitNewSite && !p.includes('seção') && !p.includes('secao') && !p.includes('botao') && !p.includes('botão'));
  if (isBlank) {
    let brandName = 'Nexus Pro';
    let badgeText = 'Lançamento Exclusivo 2026';
    let heroTitle = 'Transforme Suas Ideias em Resultados Extraordinários';
    let heroHighlight = 'Resultados Extraordinários';
    let heroSub = 'Desenvolvemos soluções inovadoras de alta conversão, tecnologia de ponta e design de classe mundial para impulsionar o seu negócio.';
    let ctaPrimary = 'Começar Agora';
    let ctaSecondary = 'Ver Demonstração';
    let card1Title = 'Velocidade Extrema';
    let card1Desc = 'Carregamento instantâneo com código leve e otimizado para máxima conversão.';
    let card2Title = 'Design Glassmorphic';
    let card2Desc = 'Visual premium com sombras sutis, degradês modernos e tipografia de alto impacto.';
    let card3Title = '100% Responsivo';
    let card3Desc = 'Experiência fluida e perfeita em qualquer tamanho de tela: Desktop, Tablet e Mobile.';
    if (p.includes('chamativo') || p.includes('titulo') || p.includes('título')) {
      brandName = 'Apex Digital';
      badgeText = 'Nova Geração de Experiências Digitais';
      heroTitle = 'O Futuro Chegou: Potencialize Sua Presença com Alta Performance';
      heroHighlight = 'Alta Performance';
      heroSub = 'Crie páginas modernas, responsivas e visualmente deslumbrantes que encantam clientes e multiplicam seus resultados desde o primeiro clique.';
      ctaPrimary = 'Explorar Plataforma';
      ctaSecondary = 'Conhecer Recursos';
    } else if (p.includes('venda') || p.includes('loja') || p.includes('ecommerce') || p.includes('produto')) {
      brandName = 'MSK Store';
      badgeText = 'Coleção Exclusiva • Descontos de até 50%';
      heroTitle = 'Os Melhores Produtos e Ofertas Exclusivas em Um Só Lugar';
      heroHighlight = 'Ofertas Exclusivas';
      heroSub = 'Descubra produtos selecionados a dedo com garantia total, entrega ultra-rápida e condições especiais de pagamento.';
      ctaPrimary = 'Ver Ofertas';
      ctaSecondary = 'Catálogo Completo';
      card1Title = 'Entrega Rápida';
      card1Desc = 'Envio expresso para todo o Brasil com rastreamento em tempo real.';
      card2Title = 'Garantia Total';
      card2Desc = 'Satisfação 100% garantida ou seu dinheiro de volta sem burocracia.';
      card3Title = 'Pagamento Seguro';
      card3Desc = 'Checkout criptografado com PIX, cartões e parcelamento facilitado.';
    } else if (p.includes('academia') || p.includes('fitness') || p.includes('treino') || p.includes('musculacao') || p.includes('musculação')) {
      brandName = 'Titan Fitness';
      badgeText = 'Matrículas Abertas • 1º Mês Grátis';
      heroTitle = 'Supere Seus Limites e Conquiste o Shape dos Seus Sonhos';
      heroHighlight = 'Shape dos Seus Sonhos';
      heroSub = 'Treinos personalizados, infraestrutura de padrão internacional e acompanhamento profissional para transformar sua saúde e estética.';
      ctaPrimary = 'Garantir Vaga';
      ctaSecondary = 'Conhecer Planos';
      card1Title = 'Equipamentos Importados';
      card1Desc = 'Biomecânica de alta performance para máxima ativação muscular.';
      card2Title = 'Acompanhamento VIP';
      card2Desc = 'Personal trainers dedicados para guiar seus resultados dia a dia.';
      card3Title = 'App de Treinos';
      card3Desc = 'Acesse suas fichas, evolução de cargas e nutrição direto no celular.';
    } else if (p.includes('restaurante') || p.includes('comida') || p.includes('gastronomia') || p.includes('hamburguer') || p.includes('hambúrguer') || p.includes('pizza')) {
      brandName = 'Sabor & Brasa';
      badgeText = 'Gastronomia Artesanal Selecionada';
      heroTitle = 'Uma Experiência Gastronômica Inesquecível a Cada Sabor';
      heroHighlight = 'Inesquecível a Cada Sabor';
      heroSub = 'Ingredientes frescos, receitas exclusivas dos nossos chefs e pratos que despertam sensações únicas para o seu paladar.';
      ctaPrimary = 'Fazer Pedido';
      ctaSecondary = 'Ver Cardápio';
      card1Title = 'Ingredientes Nobres';
      card1Desc = 'Carnes selecionadas, molhos caseiros e massas artesanais feitas no dia.';
      card2Title = 'Ambiente Sofisticado';
      card2Desc = 'Espaço aconchegante perfeito para jantares, encontros e celebrações.';
      card3Title = 'Delivery Expresso';
      card3Desc = 'Receba em casa quentinho e com embalagens térmicas especiais.';
    } else if (p.includes('portfolio') || p.includes('portfólio') || p.includes('desenvolvedor') || p.includes('programador') || p.includes('design')) {
      brandName = 'Dev & Design';
      badgeText = 'Criando Produtos Digitais Incríveis';
      heroTitle = 'Transformo Ideias Complexas em Interfaces Digitais Deslumbrantes';
      heroHighlight = 'Interfaces Digitais Deslumbrantes';
      heroSub = 'Desenvolvedor Full Stack & UI/UX Designer focado em criar aplicações web modernas, de alta performance e visual refinado.';
      ctaPrimary = 'Ver Projetos';
      ctaSecondary = 'Entrar em Contato';
      card1Title = 'Frontend Moderno';
      card1Desc = 'React, Next.js, TypeScript e animações fluidas para web.';
      card2Title = 'Backend Escalável';
      card2Desc = 'APIs REST, GraphQL, bancos de dados e microsserviços.';
      card3Title = 'Design de Impacto';
      card3Desc = 'Prototipagem no Figma, arquitetura de informação e foco total em conversão.';
    }
    resultFiles['index.html'] = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(brandName)} — ${escapeHtml(heroTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg-main: #080B11;
      --bg-card: rgba(18, 24, 38, 0.75);
      --border-card: rgba(139, 92, 246, 0.25);
      --border-card-hover: rgba(139, 92, 246, 0.55);
      --primary-1: #8B5CF6;
      --primary-2: #6366F1;
      --primary-3: #7C3AED;
      --accent-light: #C084FC;
      --accent-cyan: #38BDF8;
      --text-main: #F8FAFC;
      --text-muted: #94A3B8;
      --nav-bg: rgba(11, 15, 25, 0.88);
    }
    body {
      background: var(--bg-main);
      color: var(--text-main);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.5;
      overflow-x: hidden;
    }
    a { color: inherit; text-decoration: none; }
    /* NAVBAR */
    .navbar {
      position: sticky;
      top: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 36px;
      background: var(--nav-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border-card);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 800;
      font-size: 18px;
      letter-spacing: -0.5px;
    }
    .brand-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--primary-1), var(--primary-2));
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      color: #FFF;
      box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4);
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 28px;
      font-size: 13.5px;
      font-weight: 600;
      color: var(--text-muted);
    }
    .nav-links a { transition: color 0.2s; }
    .nav-links a:hover { color: var(--accent-light); }
    .nav-cta {
      padding: 9px 20px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--primary-1), var(--primary-3));
      color: #FFF;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 4px 16px rgba(139, 92, 246, 0.35);
      transition: all 0.25s;
    }
    .nav-cta:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 22px rgba(139, 92, 246, 0.55);
    }
    /* HERO */
    .hero {
      padding: 90px 24px 60px;
      text-align: center;
      max-width: 980px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 18px;
      border-radius: 9999px;
      background: rgba(139, 92, 246, 0.12);
      border: 1px solid var(--border-card);
      color: var(--accent-light);
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 24px;
    }
    .hero-badge-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--primary-1);
      box-shadow: 0 0 8px var(--primary-1);
    }
    .hero-title {
      font-size: 48px;
      font-weight: 900;
      line-height: 1.15;
      letter-spacing: -1.8px;
      margin-bottom: 20px;
      max-width: 860px;
    }
    .gradient-text {
      background: linear-gradient(135deg, var(--accent-light) 0%, var(--primary-1) 50%, var(--accent-cyan) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-subtitle {
      font-size: 16px;
      line-height: 1.7;
      color: var(--text-muted);
      max-width: 680px;
      margin-bottom: 36px;
    }
    .hero-buttons {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      justify-content: center;
      margin-bottom: 50px;
    }
    .btn-primary {
      padding: 14px 34px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--primary-1), var(--primary-2));
      color: #FFF;
      font-weight: 800;
      font-size: 14px;
      box-shadow: 0 6px 24px rgba(139, 92, 246, 0.4);
      border: none;
      cursor: pointer;
      transition: all 0.25s;
      font-family: inherit;
    }
    .btn-primary:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 32px rgba(139, 92, 246, 0.6);
    }
    .btn-secondary {
      padding: 14px 30px;
      border-radius: 12px;
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.2);
      color: #E2E8F0;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.25s;
      font-family: inherit;
    }
    .btn-secondary:hover {
      background: rgba(51, 65, 85, 0.8);
      border-color: rgba(148, 163, 184, 0.4);
    }
    /* STATS STRIP */
    .stats-strip {
      display: flex;
      justify-content: center;
      gap: 48px;
      flex-wrap: wrap;
      padding: 24px 40px;
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 18px;
      backdrop-filter: blur(14px);
    }
    .stat-item h4 {
      font-size: 26px;
      font-weight: 900;
      color: #FFF;
    }
    .stat-item p {
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 600;
      margin-top: 2px;
    }
    /* SECTION CONTAINERS */
    .section-container {
      max-width: 1080px;
      margin: 0 auto;
      padding: 70px 24px;
    }
    .section-header {
      text-align: center;
      margin-bottom: 48px;
    }
    .section-tag {
      font-size: 11.5px;
      font-weight: 800;
      color: var(--primary-1);
      text-transform: uppercase;
      letter-spacing: 1.2px;
    }
    .section-title {
      font-size: 32px;
      font-weight: 900;
      margin-top: 6px;
      letter-spacing: -0.8px;
    }
    /* GRID & GLASS CARDS */
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
    }
    .glass-card {
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 20px;
      padding: 32px;
      backdrop-filter: blur(16px);
      transition: all 0.3s;
    }
    .glass-card:hover {
      transform: translateY(-6px);
      border-color: var(--border-card-hover);
      box-shadow: 0 16px 36px rgba(139, 92, 246, 0.2);
    }
    .card-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: rgba(139, 92, 246, 0.15);
      border: 1px solid var(--border-card);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      margin-bottom: 20px;
    }
    .card-title {
      font-size: 18px;
      font-weight: 800;
      margin-bottom: 10px;
    }
    .card-desc {
      font-size: 13.5px;
      color: var(--text-muted);
      line-height: 1.6;
    }
    /* FOOTER */
    footer {
      border-top: 1px solid var(--border-card);
      padding: 36px 24px;
      text-align: center;
      font-size: 12.5px;
      color: #64748B;
      background: #06080E;
    }
    /* RESPONSIVE */
    @media (max-width: 768px) {
      .navbar { padding: 14px 20px; }
      .nav-links { display: none; }
      .hero { padding: 60px 16px 40px; }
      .hero-title { font-size: 32px; }
      .stats-strip { gap: 20px; padding: 20px; }
    }
  </style>
</head>
<body>
  <!-- NAVBAR -->
  <header class="navbar">
    <div class="brand">
      <div class="brand-icon">G</div>
      <span>${escapeHtml(brandName)}</span>
    </div>
    <nav class="nav-links">
      <a href="#recursos">Recursos</a>
      <a href="#solucoes">Soluções</a>
      <a href="#depoimentos">Depoimentos</a>
      <a href="#contato">Contato</a>
    </nav>
    <a href="https://wa.me/5511943213342?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20MSK%20System" target="_blank" class="nav-cta">Falar no WhatsApp</a>
  </header>
  <!-- HERO -->
  <main>
    <section class="hero">
      <div class="hero-badge">
        <span class="hero-badge-dot"></span>
        <span>${escapeHtml(badgeText)}</span>
      </div>
      <h1 class="hero-title">
        ${escapeHtml(heroTitle.replace(heroHighlight, ''))} <span class="gradient-text">${escapeHtml(heroHighlight)}</span>
      </h1>
      <p class="hero-subtitle">${escapeHtml(heroSub)}</p>
      <div class="hero-buttons">
        <button class="btn-primary">${escapeHtml(ctaPrimary)}</button>
        <button class="btn-secondary">${escapeHtml(ctaSecondary)}</button>
      </div>
      <div class="stats-strip">
        <div class="stat-item">
          <h4>+15.000</h4>
          <p>Usuários Ativos</p>
        </div>
        <div class="stat-item">
          <h4>99.9%</h4>
          <p>Disponibilidade</p>
        </div>
        <div class="stat-item">
          <h4>4.9 ★</h4>
          <p>Avaliação dos Clientes</p>
        </div>
      </div>
    </section>
    <!-- RECURSOS -->
    <section id="recursos" class="section-container">
      <div class="section-header">
        <span class="section-tag">Diferenciais</span>
        <h2 class="section-title">Por Que Escolher Nossa Solução?</h2>
      </div>
      <div class="grid-3">
        <div class="glass-card">
          <div class="card-icon">⚡</div>
          <h3 class="card-title">${escapeHtml(card1Title)}</h3>
          <p class="card-desc">${escapeHtml(card1Desc)}</p>
        </div>
        <div class="glass-card">
          <div class="card-icon">✨</div>
          <h3 class="card-title">${escapeHtml(card2Title)}</h3>
          <p class="card-desc">${escapeHtml(card2Desc)}</p>
        </div>
        <div class="glass-card">
          <div class="card-icon">📱</div>
          <h3 class="card-title">${escapeHtml(card3Title)}</h3>
          <p class="card-desc">${escapeHtml(card3Desc)}</p>
        </div>
      </div>
    </section>
  </main>
  <!-- FOOTER -->
  <footer>
    <p>MSK Studio Pro • © 2026 Todos os direitos reservados</p>
  </footer>
</body>
</html>`;
    resultFiles['styles.css'] = `/* MSK Studio Custom Styles */\n.glass-card { background: rgba(18, 24, 38, 0.75); backdrop-filter: blur(16px); }\n.gradient-text { background: linear-gradient(135deg, var(--accent-light, #C084FC), var(--primary-1, #8B5CF6), var(--accent-cyan, #38BDF8)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }`;
    resultFiles['script.js'] = `// MSK Studio Client Scripts\ndocument.addEventListener('DOMContentLoaded', () => {\n  console.log('MSK Studio Platform Online!');\n});`;
  } else {
    let updatedHtml = existingHtml;
    let updatedCss = resultFiles['styles.css'] || '';
    let updatedJs = resultFiles['script.js'] || '';
    const isFullSiteRedesign = (
      p.includes('por inteiro') || p.includes('mude o site') || p.includes('mude osite') ||
      p.includes('mudar o site') || p.includes('mudar osite') || p.includes('mude tudo') ||
      p.includes('mudar tudo') || p.includes('reformule') || p.includes('recrie') ||
      p.includes('novo visual') || p.includes('transforme') || p.includes('redesign') ||
      p.includes('mude o design') || p.includes('altere tudo') || p.includes('site todo') ||
      p.includes('site completo')
    );
    if (isFullSiteRedesign) {
      const isCurrentlyPurple = updatedHtml.includes('#8B5CF6') || updatedHtml.includes('139, 92, 246');
      const isCurrentlyGreen = updatedHtml.includes('#10B981') || updatedHtml.includes('16, 185, 129');
      const targetPalette = isCurrentlyPurple ? {
        p1: '#10B981', p2: '#059669', p3: '#047857', acc: '#34D399', cyan: '#6EE7B7',
        rgba: 'rgba(16, 185, 129, 0.25)', rgbaHover: 'rgba(16, 185, 129, 0.55)'
      } : (isCurrentlyGreen ? {
        p1: '#06B6D4', p2: '#0284C7', p3: '#0369A1', acc: '#38BDF8', cyan: '#7DD3FC',
        rgba: 'rgba(6, 182, 212, 0.25)', rgbaHover: 'rgba(6, 182, 212, 0.55)'
      } : {
        p1: '#8B5CF6', p2: '#6366F1', p3: '#7C3AED', acc: '#C084FC', cyan: '#38BDF8',
        rgba: 'rgba(139, 92, 246, 0.25)', rgbaHover: 'rgba(139, 92, 246, 0.55)'
      });
      updatedHtml = updatedHtml
        .replace(/--primary-1:\s*#[0-9a-fA-F]{6}/g, `--primary-1: ${targetPalette.p1}`)
        .replace(/--primary-2:\s*#[0-9a-fA-F]{6}/g, `--primary-2: ${targetPalette.p2}`)
        .replace(/--primary-3:\s*#[0-9a-fA-F]{6}/g, `--primary-3: ${targetPalette.p3}`)
        .replace(/--accent-light:\s*#[0-9a-fA-F]{6}/g, `--accent-light: ${targetPalette.acc}`)
        .replace(/--accent-cyan:\s*#[0-9a-fA-F]{6}/g, `--accent-cyan: ${targetPalette.cyan}`)
        .replace(/--border-card:\s*rgba\([^)]+\)/g, `--border-card: ${targetPalette.rgba}`)
        .replace(/--border-card-hover:\s*rgba\([^)]+\)/g, `--border-card-hover: ${targetPalette.rgbaHover}`)
        .replace(/#8B5CF6|#10B981|#06B6D4|#F59E0B|#F43F5E/gi, targetPalette.p1)
        .replace(/<div class="hero-badge">[\s\S]*?<\/div>/i, `<div class="hero-badge"><span class="hero-badge-dot"></span><span>⚡ Nova Plataforma Digital 2026</span></div>`)
        .replace(/<h1 class="hero-title">[\s\S]*?<\/h1>/i, `<h1 class="hero-title">Inovação e Performance: Escale com <span class="gradient-text">Resultados Extraordinários</span></h1>`)
        .replace(/<p class="hero-subtitle">[\s\S]*?<\/p>/i, `<p class="hero-subtitle">Experimente a plataforma definitiva que integra tecnologia de ponta, visual moderno e velocidade incomparável para multiplicar seus resultados.</p>`)
        .replace(/<button class="btn-primary">[\s\S]*?<\/button>/i, `<button class="btn-primary">Acessar Plataforma Agora ➔</button>`)
        .replace(/<button class="btn-secondary">[\s\S]*?<\/button>/i, `<button class="btn-secondary">Ver Demonstração</button>`);
      updatedCss = updatedCss
        .replace(/--primary-1:\s*#[0-9a-fA-F]{6}/g, `--primary-1: ${targetPalette.p1}`)
        .replace(/#8B5CF6/gi, targetPalette.p1)
        .replace(/#C084FC/gi, targetPalette.acc);
    }
    const isColorPrompt = !isFullSiteRedesign && (
      p.includes('cor') || p.includes('cores') || p.includes('color') || p.includes('colors') ||
      p.includes('paleta') || p.includes('palette') || p.includes('tema') || p.includes('theme') ||
      p.includes('verde') || p.includes('azul') || p.includes('roxo') || p.includes('laranja') ||
      p.includes('vermelho') || p.includes('rosa') || p.includes('dourado') || p.includes('amarelo') ||
      p.includes('cyan') || p.includes('green') || p.includes('blue') || p.includes('purple')
    );
    if (isColorPrompt) {
      const palettes = {
        green: {
          p1: '#10B981', p2: '#059669', p3: '#047857', acc: '#34D399', cyan: '#6EE7B7',
          rgba: 'rgba(16, 185, 129, 0.25)', rgbaHover: 'rgba(16, 185, 129, 0.55)', rgbaShadow: 'rgba(16, 185, 129, 0.4)'
        },
        cyan: {
          p1: '#06B6D4', p2: '#0284C7', p3: '#0369A1', acc: '#38BDF8', cyan: '#7DD3FC',
          rgba: 'rgba(6, 182, 212, 0.25)', rgbaHover: 'rgba(6, 182, 212, 0.55)', rgbaShadow: 'rgba(6, 182, 212, 0.4)'
        },
        orange: {
          p1: '#F59E0B', p2: '#EA580C', p3: '#D97706', acc: '#FBBF24', cyan: '#FB923C',
          rgba: 'rgba(245, 158, 11, 0.25)', rgbaHover: 'rgba(245, 158, 11, 0.55)', rgbaShadow: 'rgba(245, 158, 11, 0.4)'
        },
        rose: {
          p1: '#F43F5E', p2: '#E11D48', p3: '#BE123C', acc: '#FB7185', cyan: '#FDA4AF',
          rgba: 'rgba(244, 63, 94, 0.25)', rgbaHover: 'rgba(244, 63, 94, 0.55)', rgbaShadow: 'rgba(244, 63, 94, 0.4)'
        },
        purple: {
          p1: '#8B5CF6', p2: '#6366F1', p3: '#7C3AED', acc: '#C084FC', cyan: '#38BDF8',
          rgba: 'rgba(139, 92, 246, 0.25)', rgbaHover: 'rgba(139, 92, 246, 0.55)', rgbaShadow: 'rgba(139, 92, 246, 0.4)'
        }
      };
      let targetPalette = null;
      if (p.includes('verde') || p.includes('green') || p.includes('emerald') || p.includes('esmeralda')) {
        targetPalette = palettes.green;
      } else if (p.includes('azul') || p.includes('blue') || p.includes('cyan') || p.includes('ciano') || p.includes('celeste')) {
        targetPalette = palettes.cyan;
      } else if (p.includes('laranja') || p.includes('orange') || p.includes('amber') || p.includes('amarelo') || p.includes('dourado') || p.includes('gold')) {
        targetPalette = palettes.orange;
      } else if (p.includes('vermelho') || p.includes('red') || p.includes('rosa') || p.includes('pink') || p.includes('rose') || p.includes('carmesim')) {
        targetPalette = palettes.rose;
      } else if (p.includes('roxo') || p.includes('violeta') || p.includes('purple')) {
        targetPalette = palettes.purple;
      } else {
        if (updatedHtml.includes('#8B5CF6') || updatedHtml.includes('139, 92, 246')) {
          targetPalette = palettes.green;
        } else if (updatedHtml.includes('#10B981') || updatedHtml.includes('16, 185, 129')) {
          targetPalette = palettes.cyan;
        } else if (updatedHtml.includes('#06B6D4') || updatedHtml.includes('6, 182, 212')) {
          targetPalette = palettes.orange;
        } else {
          targetPalette = palettes.purple;
        }
      }
      if (targetPalette) {
        updatedHtml = updatedHtml
          .replace(/--primary-1:\s*#[0-9a-fA-F]{6}/g, `--primary-1: ${targetPalette.p1}`)
          .replace(/--primary-2:\s*#[0-9a-fA-F]{6}/g, `--primary-2: ${targetPalette.p2}`)
          .replace(/--primary-3:\s*#[0-9a-fA-F]{6}/g, `--primary-3: ${targetPalette.p3}`)
          .replace(/--accent-light:\s*#[0-9a-fA-F]{6}/g, `--accent-light: ${targetPalette.acc}`)
          .replace(/--accent-cyan:\s*#[0-9a-fA-F]{6}/g, `--accent-cyan: ${targetPalette.cyan}`)
          .replace(/--border-card:\s*rgba\([^)]+\)/g, `--border-card: ${targetPalette.rgba}`)
          .replace(/--border-card-hover:\s*rgba\([^)]+\)/g, `--border-card-hover: ${targetPalette.rgbaHover}`)
          .replace(/#8B5CF6/gi, targetPalette.p1)
          .replace(/#6366F1/gi, targetPalette.p2)
          .replace(/#7C3AED/gi, targetPalette.p3)
          .replace(/#C084FC/gi, targetPalette.acc)
          .replace(/#10B981/gi, targetPalette.p1)
          .replace(/#059669/gi, targetPalette.p2)
          .replace(/#047857/gi, targetPalette.p3)
          .replace(/#34D399/gi, targetPalette.acc)
          .replace(/#06B6D4/gi, targetPalette.p1)
          .replace(/#0284C7/gi, targetPalette.p2)
          .replace(/#0369A1/gi, targetPalette.p3)
          .replace(/#38BDF8/gi, targetPalette.cyan)
          .replace(/#F59E0B/gi, targetPalette.p1)
          .replace(/#EA580C/gi, targetPalette.p2)
          .replace(/#D97706/gi, targetPalette.p3)
          .replace(/#FBBF24/gi, targetPalette.acc)
          .replace(/#F43F5E/gi, targetPalette.p1)
          .replace(/#E11D48/gi, targetPalette.p2)
          .replace(/#BE123C/gi, targetPalette.p3)
          .replace(/#FB7185/gi, targetPalette.acc);
        updatedCss = updatedCss
          .replace(/--primary-1:\s*#[0-9a-fA-F]{6}/g, `--primary-1: ${targetPalette.p1}`)
          .replace(/#8B5CF6/gi, targetPalette.p1)
          .replace(/#C084FC/gi, targetPalette.acc);
      }
    }
    const isPhrasePrompt = !isFullSiteRedesign && (
      p.includes('frase') || p.includes('frases') || p.includes('texto') || p.includes('textos') ||
      p.includes('copy') || p.includes('headline') || p.includes('chamativo') || p.includes('chamativa') ||
      p.includes('profissional') || p.includes('profissionais') || p.includes('melhore o texto') ||
      p.includes('mude a escrita') || p.includes('redação') || p.includes('slogan')
    );
    if (isPhrasePrompt && !p.includes('mude o titulo para') && !p.includes('mude o título para') && !p.includes('mude o subtitulo para') && !p.includes('mude o botão para')) {
      const newBadge = '🔥 Revolucione Seus Resultados em 2026';
      const newTitlePrefix = 'Eleve Seu Negócio ao Próximo Nível com ';
      const newTitleHighlight = 'Soluções de Elite';
      const newSub = 'Acelere seu crescimento com nossa plataforma de alta conversão, engenharia refinada e arquitetura inteligente projetada para o sucesso.';
      const newCtaPrimary = 'Começar Gratuitamente ➔';
      const newCtaSecondary = 'Conhecer Soluções';
      updatedHtml = updatedHtml
        .replace(/<div class="hero-badge">[\s\S]*?<\/div>/i, `<div class="hero-badge"><span class="hero-badge-dot"></span><span>${newBadge}</span></div>`)
        .replace(/<h1 class="hero-title">[\s\S]*?<\/h1>/i, `<h1 class="hero-title">${newTitlePrefix}<span class="gradient-text">${newTitleHighlight}</span></h1>`)
        .replace(/<p class="hero-subtitle">[\s\S]*?<\/p>/i, `<p class="hero-subtitle">${newSub}</p>`)
        .replace(/<button class="btn-primary">[\s\S]*?<\/button>/i, `<button class="btn-primary">${newCtaPrimary}</button>`)
        .replace(/<button class="btn-secondary">[\s\S]*?<\/button>/i, `<button class="btn-secondary">${newCtaSecondary}</button>`);
    }
    if (p.includes('titulo para') || p.includes('título para') || p.includes('mude o titulo') || p.includes('mude o título')) {
      const match = prompt.match(/(?:para|ser|coloque)\s+["':]?\s*([^"'\n\r]+)["']?/i);
      if (match && match[1]) {
        const cleanTitle = match[1].trim();
        updatedHtml = updatedHtml.replace(/<h1 class="hero-title">[\s\S]*?<\/h1>/i, `<h1 class="hero-title"><span class="gradient-text">${escapeHtml(cleanTitle)}</span></h1>`);
      }
    }
    if (p.includes('subtitulo para') || p.includes('subtítulo para') || p.includes('mude o subtitulo') || p.includes('mude o subtítulo')) {
      const match = prompt.match(/(?:para|ser|coloque)\s+["':]?\s*([^"'\n\r]+)["']?/i);
      if (match && match[1]) {
        const cleanSub = match[1].trim();
        updatedHtml = updatedHtml.replace(/<p class="hero-subtitle">[\s\S]*?<\/p>/i, `<p class="hero-subtitle">${escapeHtml(cleanSub)}</p>`);
      }
    }
    if (p.includes('botao para') || p.includes('botão para') || p.includes('texto do botao') || p.includes('texto do botão')) {
      const match = prompt.match(/(?:para|ser|coloque)\s+["':]?\s*([^"'\n\r]+)["']?/i);
      if (match && match[1]) {
        const cleanBtn = match[1].trim();
        updatedHtml = updatedHtml.replace(/<button class="btn-primary">[\s\S]*?<\/button>/i, `<button class="btn-primary">${escapeHtml(cleanBtn)}</button>`);
      }
    }
    if (p.includes('nome da empresa para') || p.includes('nome do site para') || p.includes('marca para')) {
      const match = prompt.match(/(?:para|ser)\s+["':]?\s*([^"'\n\r]+)["']?/i);
      if (match && match[1]) {
        const cleanBrand = match[1].trim();
        updatedHtml = updatedHtml
          .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(cleanBrand)}</title>`)
          .replace(/<div class="brand">[\s\S]*?<\/div>/i, `<div class="brand"><div class="brand-icon">${escapeHtml(cleanBrand.charAt(0))}</div><span>${escapeHtml(cleanBrand)}</span></div>`);
      }
    }
    if (p.includes('faq') || p.includes('perguntas') || p.includes('duvidas') || p.includes('dúvidas')) {
      if (!updatedHtml.includes('id="faq"')) {
        const faqSection = `
    <!-- FAQ SECTION -->
    <section id="faq" class="section-container" style="border-top: 1px solid var(--border-card, rgba(139,92,246,0.25));">
      <div class="section-header">
        <span class="section-tag">Tire Suas Dúvidas</span>
        <h2 class="section-title">Perguntas Frequentes (FAQ)</h2>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;max-width:820px;margin:0 auto;">
        <details style="padding:18px 24px;border-radius:14px;background:var(--bg-card, rgba(18,24,38,0.75));border:1px solid var(--border-card, rgba(139,92,246,0.25));cursor:pointer;">
          <summary style="font-weight:700;font-size:15px;color:var(--accent-light, #C084FC);">Como funciona a plataforma?</summary>
          <p style="font-size:13.5px;color:var(--text-muted, #94A3B8);margin-top:10px;line-height:1.6;">Basta descrever sua ideia no chat inteligente do MSK Studio. A inteligência artificial gera código completo, estrutura de pastas e visualização ao vivo em segundos.</p>
        </details>
        <details style="padding:18px 24px;border-radius:14px;background:var(--bg-card, rgba(18,24,38,0.75));border:1px solid var(--border-card, rgba(139,92,246,0.25));cursor:pointer;">
          <summary style="font-weight:700;font-size:15px;color:var(--accent-light, #C084FC);">Posso exportar o código e hospedar onde quiser?</summary>
          <p style="font-size:13.5px;color:var(--text-muted, #94A3B8);margin-top:10px;line-height:1.6;">Sim! Com 1 clique no botão 'Baixar ZIP' você obtém todo o HTML, CSS e JavaScript puros prontos para colocar no Vercel, Netlify, VPS ou qualquer hospedagem.</p>
        </details>
        <details style="padding:18px 24px;border-radius:14px;background:var(--bg-card, rgba(18,24,38,0.75));border:1px solid var(--border-card, rgba(139,92,246,0.25));cursor:pointer;">
          <summary style="font-weight:700;font-size:15px;color:var(--accent-light, #C084FC);">O site é 100% responsivo para celulares e tablets?</summary>
          <p style="font-size:13.5px;color:var(--text-muted, #94A3B8);margin-top:10px;line-height:1.6;">Absolutamente. Toda a tipografia, grids e componentes são construídos com layout fluído e adaptável para qualquer resolução.</p>
        </details>
      </div>
    </section>`;
        updatedHtml = insertBeforeClosing(updatedHtml, faqSection);
      }
    }
    if (p.includes('depoimento') || p.includes('depoimentos') || p.includes('avaliacao') || p.includes('avaliações') || p.includes('testimonial') || p.includes('clientes')) {
      if (!updatedHtml.includes('id="depoimentos"')) {
        const testimonialsSection = `
    <!-- DEPOIMENTOS -->
    <section id="depoimentos" class="section-container" style="border-top: 1px solid var(--border-card, rgba(139,92,246,0.25));">
      <div class="section-header">
        <span class="section-tag">Depoimentos Reais</span>
        <h2 class="section-title">O Que Nossos Clientes Dizem</h2>
      </div>
      <div class="grid-3">
        <div class="glass-card">
          <div style="color:#FBBF24;font-size:16px;margin-bottom:12px;">★★★★★</div>
          <p style="font-size:14px;color:var(--text-muted, #94A3B8);line-height:1.6;font-style:italic;">"O resultado superou todas as expectativas. Nossa taxa de conversão aumentou mais de 40% logo na primeira semana após o lançamento."</p>
          <div style="display:flex;align-items:center;gap:12px;margin-top:20px;">
            <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg, var(--primary-1, #8B5CF6), var(--primary-2, #6366F1));display:flex;align-items:center;justify-content:center;font-weight:800;color:#FFF;">RC</div>
            <div>
              <h5 style="font-size:14px;font-weight:800;color:#FFF;">Rodrigo Castro</h5>
              <span style="font-size:11.5px;color:var(--text-muted, #94A3B8);">CEO @ TechNova</span>
            </div>
          </div>
        </div>
        <div class="glass-card">
          <div style="color:#FBBF24;font-size:16px;margin-bottom:12px;">★★★★★</div>
          <p style="font-size:14px;color:var(--text-muted, #94A3B8);line-height:1.6;font-style:italic;">"Design impecável, velocidade incrível e facilidade total de uso. É sem dúvida a melhor solução do mercado atualmente."</p>
          <div style="display:flex;align-items:center;gap:12px;margin-top:20px;">
            <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg, var(--primary-2, #6366F1), var(--accent-cyan, #38BDF8));display:flex;align-items:center;justify-content:center;font-weight:800;color:#FFF;">AM</div>
            <div>
              <h5 style="font-size:14px;font-weight:800;color:#FFF;">Ana Martins</h5>
              <span style="font-size:11.5px;color:var(--text-muted, #94A3B8);">Diretora de Marketing</span>
            </div>
          </div>
        </div>
        <div class="glass-card">
          <div style="color:#FBBF24;font-size:16px;margin-bottom:12px;">★★★★★</div>
          <p style="font-size:14px;color:var(--text-muted, #94A3B8);line-height:1.6;font-style:italic;">"Economizamos semanas de desenvolvimento com uma entrega profissional de nível internacional. Recomendo fortemente!"</p>
          <div style="display:flex;align-items:center;gap:12px;margin-top:20px;">
            <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg, var(--primary-3, #7C3AED), var(--accent-light, #C084FC));display:flex;align-items:center;justify-content:center;font-weight:800;color:#FFF;">FL</div>
            <div>
              <h5 style="font-size:14px;font-weight:800;color:#FFF;">Felipe Lima</h5>
              <span style="font-size:11.5px;color:var(--text-muted, #94A3B8);">Fundador @ ScaleUp</span>
            </div>
          </div>
        </div>
      </div>
    </section>`;
        updatedHtml = insertBeforeClosing(updatedHtml, testimonialsSection);
      }
    }
    if (p.includes('preco') || p.includes('preço') || p.includes('precos') || p.includes('preços') || p.includes('plano') || p.includes('planos') || p.includes('pricing') || p.includes('tabela')) {
      if (!updatedHtml.includes('id="precos"')) {
        const pricingSection = `
    <!-- PLANOS E PREÇOS -->
    <section id="precos" class="section-container" style="border-top: 1px solid var(--border-card, rgba(139,92,246,0.25));">
      <div class="section-header">
        <span class="section-tag">Investimento Transparente</span>
        <h2 class="section-title">Planos Feitos Para a Sua Escala</h2>
      </div>
      <div class="grid-3">
        <div class="glass-card" style="display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <span style="font-size:12px;font-weight:800;color:var(--text-muted, #94A3B8);text-transform:uppercase;">Starter</span>
            <div style="font-size:36px;font-weight:900;color:#FFF;margin:12px 0 6px;">R$ 97<span style="font-size:13px;font-weight:600;color:var(--text-muted, #94A3B8);">/mês</span></div>
            <p style="font-size:13px;color:var(--text-muted, #94A3B8);margin-bottom:20px;">Ideal para profissionais autônomos e validação de projetos.</p>
            <ul style="list-style:none;font-size:13px;color:var(--text-main, #F8FAFC);display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
              <li>✓ 1 Projeto Ativo</li>
              <li>✓ Exportação de Código ZIP</li>
              <li>✓ Suporte por Email</li>
            </ul>
          </div>
          <button class="btn-secondary" style="width:100%;">Assinar Starter</button>
        </div>
        <div class="glass-card" style="border-color:var(--primary-1, #8B5CF6);box-shadow:0 0 30px rgba(139,92,246,0.3);position:relative;display:flex;flex-direction:column;justify-content:space-between;">
          <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg, var(--primary-1, #8B5CF6), var(--primary-2, #6366F1));color:#FFF;font-size:11px;font-weight:800;padding:4px 14px;border-radius:9999px;">MAIS POPULAR</div>
          <div>
            <span style="font-size:12px;font-weight:800;color:var(--accent-light, #C084FC);text-transform:uppercase;">Professional</span>
            <div style="font-size:36px;font-weight:900;color:#FFF;margin:12px 0 6px;">R$ 197<span style="font-size:13px;font-weight:600;color:var(--text-muted, #94A3B8);">/mês</span></div>
            <p style="font-size:13px;color:var(--text-muted, #94A3B8);margin-bottom:20px;">Para empresas e criadores que buscam alta conversão contínua.</p>
            <ul style="list-style:none;font-size:13px;color:var(--text-main, #F8FAFC);display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
              <li>✓ Projetos Ilimitados</li>
              <li>✓ IA Central MSK gerenciada pelo Admin</li>
              <li>✓ Suporte Prioritário WhatsApp VIP</li>
              <li>✓ Domínio Personalizado</li>
            </ul>
          </div>
          <button class="btn-primary" style="width:100%;">Garantir Oferta Pro</button>
        </div>
        <div class="glass-card" style="display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <span style="font-size:12px;font-weight:800;color:var(--text-muted, #94A3B8);text-transform:uppercase;">Enterprise</span>
            <div style="font-size:36px;font-weight:900;color:#FFF;margin:12px 0 6px;">R$ 497<span style="font-size:13px;font-weight:600;color:var(--text-muted, #94A3B8);">/mês</span></div>
            <p style="font-size:13px;color:var(--text-muted, #94A3B8);margin-bottom:20px;">Infraestrutura dedicada com suporte de engenharia 24/7.</p>
            <ul style="list-style:none;font-size:13px;color:var(--text-main, #F8FAFC);display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
              <li>✓ Acesso Total à API</li>
              <li>✓ SLA 99.99% Garantido</li>
              <li>✓ Consultoria de Design 1:1</li>
            </ul>
          </div>
          <button class="btn-secondary" style="width:100%;">Falar com Consultor</button>
        </div>
      </div>
    </section>`;
        updatedHtml = insertBeforeClosing(updatedHtml, pricingSection);
      }
    }
    if (p.includes('contato') || p.includes('contact') || p.includes('formulario') || p.includes('formulário') || p.includes('fale conosco')) {
      if (!updatedHtml.includes('id="contato"')) {
        const contactSection = `
    <!-- CONTATO -->
    <section id="contato" class="section-container" style="border-top: 1px solid var(--border-card, rgba(139,92,246,0.25));">
      <div class="section-header">
        <span class="section-tag">Fale Conosco</span>
        <h2 class="section-title">Inicie Sua Transformação Hoje</h2>
      </div>
      <div class="glass-card" style="max-width:680px;margin:0 auto;">
        <form onsubmit="event.preventDefault(); alert('Mensagem enviada com sucesso! Nossa equipe entrará em contato em instantes.');" style="display:flex;flex-direction:column;gap:16px;">
          <div>
            <label style="font-size:12.5px;font-weight:700;color:var(--text-muted, #94A3B8);display:block;margin-bottom:6px;">Seu Nome Completo</label>
            <input type="text" placeholder="Ex: Maria Silva" required style="width:100%;padding:12px 16px;border-radius:10px;background:rgba(11,15,25,0.8);border:1px solid var(--border-card, rgba(139,92,246,0.25));color:#FFF;font-size:13.5px;outline:none;font-family:inherit;">
          </div>
          <div>
            <label style="font-size:12.5px;font-weight:700;color:var(--text-muted, #94A3B8);display:block;margin-bottom:6px;">Seu Melhor Email</label>
            <input type="email" placeholder="seuemail@empresa.com" required style="width:100%;padding:12px 16px;border-radius:10px;background:rgba(11,15,25,0.8);border:1px solid var(--border-card, rgba(139,92,246,0.25));color:#FFF;font-size:13.5px;outline:none;font-family:inherit;">
          </div>
          <div>
            <label style="font-size:12.5px;font-weight:700;color:var(--text-muted, #94A3B8);display:block;margin-bottom:6px;">Mensagem ou Projeto</label>
            <textarea rows="4" placeholder="Conte brevemente sobre o seu objetivo..." required style="width:100%;padding:12px 16px;border-radius:10px;background:rgba(11,15,25,0.8);border:1px solid var(--border-card, rgba(139,92,246,0.25));color:#FFF;font-size:13.5px;outline:none;font-family:inherit;resize:vertical;"></textarea>
          </div>
          <button type="submit" class="btn-primary" style="margin-top:8px;padding:14px;">Enviar Mensagem Agora</button>
        </form>
      </div>
    </section>`;
        updatedHtml = insertBeforeClosing(updatedHtml, contactSection);
      }
    }
    if (updatedHtml === existingHtml) {
      const nextPalette = updatedHtml.includes('#10B981') ? {
        p1: '#06B6D4', p2: '#0284C7', p3: '#0369A1', acc: '#38BDF8', cyan: '#7DD3FC',
        rgba: 'rgba(6, 182, 212, 0.25)', rgbaHover: 'rgba(6, 182, 212, 0.55)'
      } : {
        p1: '#10B981', p2: '#059669', p3: '#047857', acc: '#34D399', cyan: '#6EE7B7',
        rgba: 'rgba(16, 185, 129, 0.25)', rgbaHover: 'rgba(16, 185, 129, 0.55)'
      };
      updatedHtml = updatedHtml
        .replace(/--primary-1:\s*#[0-9a-fA-F]{6}/g, `--primary-1: ${nextPalette.p1}`)
        .replace(/--primary-2:\s*#[0-9a-fA-F]{6}/g, `--primary-2: ${nextPalette.p2}`)
        .replace(/--primary-3:\s*#[0-9a-fA-F]{6}/g, `--primary-3: ${nextPalette.p3}`)
        .replace(/--accent-light:\s*#[0-9a-fA-F]{6}/g, `--accent-light: ${nextPalette.acc}`)
        .replace(/--accent-cyan:\s*#[0-9a-fA-F]{6}/g, `--accent-cyan: ${nextPalette.cyan}`)
        .replace(/--border-card:\s*rgba\([^)]+\)/g, `--border-card: ${nextPalette.rgba}`)
        .replace(/--border-card-hover:\s*rgba\([^)]+\)/g, `--border-card-hover: ${nextPalette.rgbaHover}`)
        .replace(/#8B5CF6|#10B981|#06B6D4|#F59E0B|#F43F5E/gi, nextPalette.p1)
        .replace(/<div class="hero-badge">[\s\S]*?<\/div>/i, `<div class="hero-badge"><span class="hero-badge-dot"></span><span>⚡ Atualização Inteligente Aplicada</span></div>`);
    }
    if (role === 'designer') {
      if (!updatedHtml.includes('designer-glow-effect')) {
        const designerGlow = `
<style id="designer-glow-effect">
  .glass-card { box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1) !important; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important; }
  .glass-card:hover { transform: translateY(-4px); box-shadow: 0 16px 36px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.2) !important; }
  .btn-primary { animation: subtle-glow 3s ease-in-out infinite alternate; }
  @keyframes subtle-glow { from { box-shadow: 0 6px 20px rgba(139,92,246,0.35); } to { box-shadow: 0 8px 30px rgba(139,92,246,0.65); } }
</style>`;
        updatedHtml = updatedHtml.replace('</head>', `${designerGlow}\n</head>`);
      }
    } else if (role === 'fullstack') {
      if (!updatedJs.includes('smooth-scroll-active')) {
        updatedJs += `\n// FullStack Agent Interactive Enhancements\ndocument.querySelectorAll('a[href^="#"]').forEach(anchor => {\n  anchor.addEventListener('click', function(e) {\n    e.preventDefault();\n    const target = document.querySelector(this.getAttribute('href'));\n    if (target) target.scrollIntoView({ behavior: 'smooth' });\n  });\n});\n// smooth-scroll-active`;
      }
    }
    resultFiles['index.html'] = updatedHtml;
    resultFiles['styles.css'] = updatedCss;
    resultFiles['script.js'] = updatedJs;
  }
  return resultFiles;
}
function hexToRgb(hex) {
  if (!hex) return '139, 92, 246';
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}
function insertBeforeClosing(html, snippet) {
  if (html.includes('</main>')) {
    return html.replace('</main>', snippet + '\n</main>');
  } else if (html.includes('</body>')) {
    return html.replace('</body>', snippet + '\n</body>');
  }
  return html + snippet;
}
btnNewProject?.addEventListener('click', () => {
  modalNewProject?.classList.remove('hidden');
  if (newProjNameInput) {
    newProjNameInput.value = 'Projeto ' + (state.projects.length + 1);
    newProjNameInput.focus();
  }
});
modalClose?.addEventListener('click', () => modalNewProject?.classList.add('hidden'));
modalNewProject?.addEventListener('click', (e) => {
  if (e.target === modalNewProject) modalNewProject?.classList.add('hidden');
});
let selectedTemplate = 'blank';
document.querySelectorAll('.template-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.template-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    selectedTemplate = card.getAttribute('data-tpl');
  });
});
btnConfirmCreate?.addEventListener('click', () => {
  const name = newProjNameInput?.value.trim() || 'Novo Projeto';
  const tplFiles = DEFAULT_TEMPLATES[selectedTemplate] || DEFAULT_TEMPLATES.blank;
  const newProj = {
    id: 'proj_' + Date.now().toString(36),
    name: name,
    files: JSON.parse(JSON.stringify(tplFiles)),
    checkpoints: [
      { id: 'chk_init', date: new Date().toISOString(), reason: 'Projeto Inicial Criado', filesCount: 1 }
    ],
    chatHistory: []
  };
  state.projects.unshift(newProj);
  state.currentProjectId = newProj.id;
  saveProjects();
  modalNewProject?.classList.add('hidden');
  renderProjectSelector();
  loadCurrentProject();
  toast('✓ Novo projeto pronto!', 2000);
});
function applyTheme(theme = 'dark') {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    themeSunBox?.classList.remove('active');
    themeMoonBox?.classList.add('active');
  } else {
    themeSunBox?.classList.add('active');
    themeMoonBox?.classList.remove('active');
  }
}
themeToggle?.addEventListener('click', () => {
  const next = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  chrome.storage.local.set({ theme: next });
});
let toastTimer;
function toast(msg, ms = 3000) {
  const el = $('studio-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  if (ms > 0) toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
setupProviderSelect();
initStudio();
