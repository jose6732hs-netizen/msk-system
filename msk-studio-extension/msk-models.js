/*! MSK SYSTEM • Catálogo de IAs/modelos liberados pelo Super Admin. */
'use strict';
(() => {
  const CATALOG_URLS = [
    'https://msksystem.online/api/public/extension-models',
    'https://msk-system.lovable.app/api/public/extension-models',
  ];
  const STORE_KEY = 'msk_ai_selection_v1';
  const CACHE_KEY = 'msk_ai_catalog_cache_v1';
  const PROVIDER_LABELS = {
    groq: 'Groq', gemini: 'Google Gemini', openrouter: 'OpenRouter', omniroute: 'OmniRoute',
    bai: 'B.AI', claude: 'Claude', synterolink: 'Claude · SynteroLink', openai: 'OpenAI',
    mistral: 'Mistral AI', manus: 'Manus AI',
  };
  const state = {
    models: [], provider: '', model: '', loaded: false, loading: null,
    source: 'loading', error: '', retryTimer: null, retryAttempt: 0,
  };
  const bindings = new WeakMap();
  const providerLabel = (id) => PROVIDER_LABELS[String(id || '').toLowerCase()] || String(id || '').toUpperCase();
  const storageGet = (keys) => new Promise((resolve) => {
    try { chrome.storage.local.get(keys, (value) => resolve(value || {})); }
    catch { resolve({}); }
  });
  const storageSet = (value) => new Promise((resolve) => {
    try { chrome.storage.local.set(value, resolve); }
    catch { resolve(); }
  });
  function cleanModels(value) {
    const list = Array.isArray(value) ? value : [];
    const seen = new Set();
    return list
      .filter((item) => item && item.provider && item.model && item.enabled !== false && item.allowed !== false)
      .map((item) => ({ ...item, provider: String(item.provider).toLowerCase(), model: String(item.model) }))
      .filter((item) => {
        const key = `${item.provider}::${item.model}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }
  function relayFetch(url) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'msk-fetch-catalog', url }, (reply) => {
          void chrome.runtime.lastError;
          resolve(reply?.ok ? cleanModels(reply.models) : []);
        });
      } catch { resolve([]); }
    });
  }
  async function fetchOnce(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) return [];
      const data = await response.json().catch(() => ({}));
      return cleanModels(data?.models);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
  async function fetchCatalog() {
    for (const url of CATALOG_URLS) {
      const direct = await fetchOnce(url);
      if (direct.length) return direct;
      const relayed = await relayFetch(url);
      if (relayed.length) return relayed;
    }
    return [];
  }

  function providers() { return [...new Set(state.models.map((item) => item.provider))]; }
  function modelsOf(provider) { return state.models.filter((item) => item.provider === provider); }
  function getSelection() {
    const found = state.models.find((item) => item.provider === state.provider && item.model === state.model);
    return {
      provider: state.provider,
      model: state.model,
      label: found?.label || state.model,
      count: state.models.length,
      ready: Boolean(found),
      source: state.source,
      error: state.error,
    };
  }
  function persistSelection() {
    void storageSet({ [STORE_KEY]: { provider: state.provider, model: state.model } });
  }
  function fillProviderSelect(select) {
    if (!select) return;
    select.innerHTML = '';
    const list = providers();
    if (!list.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = state.loading ? 'Carregando catálogo…' : 'Catálogo indisponível';
      select.appendChild(option);
      select.disabled = true;
      select.classList.remove('hidden');
      return;
    }
    for (const provider of list) {
      const option = document.createElement('option');
      option.value = provider;
      option.textContent = providerLabel(provider);
      select.appendChild(option);
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
      const option = document.createElement('option');
      option.value = '';
      option.textContent = state.loading ? 'Carregando modelos…' : 'Nenhum modelo disponível';
      select.appendChild(option);
      select.disabled = true;
      select.classList.remove('hidden');
      return;
    }
    for (const item of list) {
      const option = document.createElement('option');
      option.value = item.model;
      option.textContent = `${item.label || item.model}${item.free ? ' • grátis' : ''}`;
      if (item.note) option.title = item.note;
      select.appendChild(option);
    }
    if (!list.some((item) => item.model === state.model)) state.model = list[0].model;
    select.value = state.model;
    select.disabled = false;
    select.classList.remove('hidden');
  }
  function renderBinding(binding) {
    fillProviderSelect(binding.providerSelect);
    fillModelSelect(binding.modelSelect);
    binding.onChange(getSelection());
  }
  function renderKnownBindings() {
    document.querySelectorAll('select').forEach((select) => {
      const binding = bindings.get(select);
      if (binding?.providerSelect === select) renderBinding(binding);
    });
  }
  async function ensureLoaded(force = false) {
    if (state.loading) return state.loading;
    if (state.loaded && !force) return state.models;
    state.loading = (async () => {
      const saved = await storageGet([STORE_KEY, CACHE_KEY]);
      const cached = cleanModels(saved?.[CACHE_KEY]?.models);
      if (!state.models.length && cached.length) {
        state.models = cached;
        state.source = 'cache';
      }
      const online = await fetchCatalog();
      if (online.length) {
        state.models = online;
        state.source = 'network';
        state.error = '';
        state.retryAttempt = 0;
        await storageSet({ [CACHE_KEY]: { models: online, updatedAt: Date.now() } });
      } else if (state.models.length) {
        state.source = 'cache';
        state.error = 'Catálogo online temporariamente indisponível; usando a última lista válida.';
      } else {
        state.source = 'unavailable';
        state.error = 'Catálogo do Admin indisponível.';
      }
      state.loaded = true;
      const selected = saved?.[STORE_KEY] || {};
      if (selected.provider && state.models.some((item) => item.provider === selected.provider)) state.provider = selected.provider;
      if (!state.provider || !state.models.some((item) => item.provider === state.provider)) state.provider = state.models[0]?.provider || '';
      if (selected.model && state.models.some((item) => item.provider === state.provider && item.model === selected.model)) state.model = selected.model;
      if (!state.model || !state.models.some((item) => item.provider === state.provider && item.model === state.model)) state.model = modelsOf(state.provider)[0]?.model || '';
      persistSelection();
      return state.models;
    })().finally(() => {
      state.loading = null;
      renderKnownBindings();
    });
    return state.loading;
  }
  function scheduleRetry() {
    if (state.models.length || state.retryTimer || state.retryAttempt >= 3) return;
    const delays = [3000, 8000, 15000];
    const delay = delays[state.retryAttempt] || delays[delays.length - 1];
    state.retryAttempt += 1;
    state.retryTimer = setTimeout(async () => {
      state.retryTimer = null;
      await ensureLoaded(true);
      if (!state.models.length) scheduleRetry();
    }, delay);
  }
  async function attach({ providerSelect, modelSelect, onChange = () => {} } = {}) {
    const binding = { providerSelect, modelSelect, onChange };
    if (providerSelect) bindings.set(providerSelect, binding);
    if (modelSelect) bindings.set(modelSelect, binding);
    if (!state.loaded) {
      if (providerSelect) {
        providerSelect.innerHTML = '<option value="">Carregando catálogo…</option>';
        providerSelect.disabled = true;
        providerSelect.classList.remove('hidden');
      }
      if (modelSelect) {
        modelSelect.innerHTML = '<option value="">Carregando modelos…</option>';
        modelSelect.disabled = true;
        modelSelect.classList.remove('hidden');
      }
    }
    if (providerSelect && providerSelect.dataset.mskModelsBound !== '1') {
      providerSelect.dataset.mskModelsBound = '1';
      providerSelect.addEventListener('change', () => {
        state.provider = providerSelect.value;
        state.model = modelsOf(state.provider)[0]?.model || '';
        fillModelSelect(modelSelect);
        persistSelection();
        onChange(getSelection());
      });
    }
    if (modelSelect && modelSelect.dataset.mskModelsBound !== '1') {
      modelSelect.dataset.mskModelsBound = '1';
      modelSelect.addEventListener('change', () => {
        state.model = modelSelect.value;
        persistSelection();
        onChange(getSelection());
      });
    }
    await ensureLoaded(false);
    renderBinding(binding);
    scheduleRetry();
    return getSelection();
  }
  async function loadSelection() {
    await ensureLoaded(false);
    return getSelection();
  }
  async function refresh() {
    await ensureLoaded(true);
    renderKnownBindings();
    scheduleRetry();
    return getSelection();
  }
  window.MSKModels = { attach, getSelection, loadSelection, providerLabel, refresh };
})();