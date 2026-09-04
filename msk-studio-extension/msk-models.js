/*! MSK SYSTEM • Catálogo de IAs/modelos liberados pelo Super Admin. */
'use strict';
(() => {
  const CATALOG_URLS = [
    'https://msksystem.online/api/public/extension-models',
    'https://msk-system.lovable.app/api/public/extension-models',
  ];
  const STORE_KEY = 'msk_ai_selection_v1';
  const PROVIDER_LABELS = {
    groq: 'Groq', gemini: 'Google Gemini', openrouter: 'OpenRouter', omniroute: 'OmniRoute',
    bai: 'B.AI', claude: 'Claude', synterolink: 'Claude · SynteroLink', openai: 'OpenAI',
    mistral: 'Mistral AI', manus: 'Manus AI',
  };
  const state = { models: [], provider: '', model: '', loaded: false, loading: null, retrying: false };
  const bound = new WeakSet();
  const providerLabel = (id) => PROVIDER_LABELS[String(id || '').toLowerCase()] || String(id || '').toUpperCase();

  async function readSaved() {
    return await new Promise((resolve) => {
      try { chrome.storage.local.get([STORE_KEY], (v) => resolve(v?.[STORE_KEY] || {})); }
      catch { resolve({}); }
    });
  }
  function persist() {
    try { chrome.storage.local.set({ [STORE_KEY]: { provider: state.provider, model: state.model } }); } catch {}
  }
  async function fetchOnce(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!res.ok) return [];
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data?.models) ? data.models : [];
      const seen = new Set();
      return list
        .filter((m) => m && m.provider && m.model && m.enabled !== false && m.allowed !== false)
        .filter((m) => {
          const key = `${String(m.provider).toLowerCase()}::${String(m.model)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    } catch { return []; }
    finally { clearTimeout(timer); }
  }
  async function fetchCatalog() {
    for (const url of CATALOG_URLS) {
      const list = await fetchOnce(url);
      if (list.length) return list;
    }
    return [];
  }
  function providers() { return [...new Set(state.models.map((m) => m.provider))]; }
  function modelsOf(provider) { return state.models.filter((m) => m.provider === provider); }
  function fillProviderSelect(select) {
    if (!select) return;
    select.innerHTML = '';
    const list = providers();
    if (!list.length) {
      select.innerHTML = '<option value="">Catálogo do Admin indisponível</option>';
      select.disabled = true;
      select.classList.remove('hidden');
      return;
    }
    for (const p of list) {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = providerLabel(p);
      select.appendChild(opt);
    }
    if (!list.includes(state.provider)) state.provider = list[0] || '';
    select.value = state.provider;
    select.disabled = false;
    select.classList.remove('hidden');
  }
  function fillModelSelect(select) {
    if (!select) return;
    select.innerHTML = '';
    const list = modelsOf(state.provider);
    if (!list.length) {
      select.innerHTML = '<option value="">Nenhum modelo liberado</option>';
      select.disabled = true;
      select.classList.remove('hidden');
      return;
    }
    for (const m of list) {
      const opt = document.createElement('option');
      opt.value = m.model;
      opt.textContent = `${m.label || m.model}${m.free ? ' • grátis' : ''}`;
      if (m.note) opt.title = m.note;
      select.appendChild(opt);
    }
    if (!list.some((m) => m.model === state.model)) state.model = list[0].model;
    select.value = state.model;
    select.disabled = false;
    select.classList.remove('hidden');
  }
  function getSelection() {
    const found = state.models.find((m) => m.provider === state.provider && m.model === state.model);
    return { provider: state.provider, model: state.model, label: found?.label || state.model, count: state.models.length };
  }
  function refreshControls(providerSelect, modelSelect, onChange) {
    fillProviderSelect(providerSelect);
    fillModelSelect(modelSelect);
    persist();
    onChange(getSelection());
  }
  async function ensureLoaded(force = false) {
    if (state.loading) return state.loading;
    if (state.loaded && !force) return state.models;
    state.loading = (async () => {
      const [models, saved] = await Promise.all([fetchCatalog(), readSaved()]);
      state.models = models;
      state.loaded = true;
      state.provider = saved.provider && models.some((m) => m.provider === saved.provider) ? saved.provider : (models[0]?.provider || '');
      state.model = saved.model && models.some((m) => m.provider === state.provider && m.model === saved.model) ? saved.model : (modelsOf(state.provider)[0]?.model || '');
      return models;
    })().finally(() => { state.loading = null; });
    return state.loading;
  }
  async function attach({ providerSelect, modelSelect, onChange = () => {} } = {}) {
    await ensureLoaded(false);
    refreshControls(providerSelect, modelSelect, onChange);
    if (providerSelect && !bound.has(providerSelect)) {
      bound.add(providerSelect);
      providerSelect.addEventListener('change', () => {
        state.provider = providerSelect.value;
        state.model = modelsOf(state.provider)[0]?.model || '';
        fillModelSelect(modelSelect);
        persist();
        onChange(getSelection());
      });
    }
    if (modelSelect && !bound.has(modelSelect)) {
      bound.add(modelSelect);
      modelSelect.addEventListener('change', () => {
        state.model = modelSelect.value;
        persist();
        onChange(getSelection());
      });
    }
    if (!state.models.length && !state.retrying) {
      state.retrying = true;
      void (async () => {
        for (let attempt = 1; attempt <= 6; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, attempt === 1 ? 2500 : 5000));
          await ensureLoaded(true);
          refreshControls(providerSelect, modelSelect, onChange);
          if (state.models.length) break;
        }
        state.retrying = false;
      })();
    }
    return getSelection();
  }
  async function loadSelection() { await ensureLoaded(false); return getSelection(); }
  window.MSKModels = { attach, getSelection, loadSelection, providerLabel, refresh: () => ensureLoaded(true) };
})();
