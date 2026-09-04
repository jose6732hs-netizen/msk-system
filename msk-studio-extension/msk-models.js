/*! MSK SYSTEM • Catálogo de modelos liberados pelo Super Admin. */
'use strict';
(() => {
  const CATALOG_URL = 'https://msksystem.online/api/public/extension-models';
  const STORE_KEY = 'msk_ai_selection_v1';
  const PROVIDER_LABELS = {
    groq: 'Groq',
    gemini: 'Google Gemini',
    openrouter: 'OpenRouter',
    omniroute: 'OmniRoute',
    bai: 'B.AI',
    claude: 'Claude',
    openai: 'OpenAI',
  };

  const state = { models: [], provider: '', model: '', loaded: false };

  const providerLabel = (id) => PROVIDER_LABELS[id] || String(id || '').toUpperCase();

  async function readSaved() {
    return await new Promise((resolve) => {
      try { chrome.storage.local.get([STORE_KEY], (v) => resolve(v?.[STORE_KEY] || {})); }
      catch { resolve({}); }
    });
  }

  function persist() {
    try { chrome.storage.local.set({ [STORE_KEY]: { provider: state.provider, model: state.model } }); } catch {}
  }

  const FALLBACK = [
    { provider: 'groq', model: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Groq)', free: true },
    { provider: 'groq', model: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (Groq)', free: true },
    { provider: 'groq', model: 'qwen/qwen3-32b', label: 'Qwen3 32B (Groq)', free: true },
  ];

  const MIRRORS = [CATALOG_URL, 'https://msk-system.lovable.app/api/public/extension-models'];

  async function fetchOnce(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data?.models) ? data.models : [];
      return list.filter((m) => m && m.provider && m.model);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchCatalog() {
    for (const url of MIRRORS) {
      const list = await fetchOnce(url);
      if (list.length) return list;
    }
    return [];
  }


  function providers() {
    return [...new Set(state.models.map((m) => m.provider))];
  }

  function modelsOf(provider) {
    return state.models.filter((m) => m.provider === provider);
  }

  function fillProviderSelect(select) {
    if (!select) return;
    select.innerHTML = '';
    const list = providers();
    if (!list.length) {
      select.innerHTML = '<option value="">Nenhum modelo liberado</option>';
      select.disabled = true;
      return;
    }
    for (const p of list) {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = providerLabel(p);
      select.appendChild(opt);
    }
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

  /**
   * Liga um par de <select> (provedor + modelo) ao catálogo publicado.
   * onChange recebe { provider, model }.
   */
  async function attach({ providerSelect, modelSelect, onChange = () => {} } = {}) {
    if (!state.loaded) {
      const [models, saved] = await Promise.all([fetchCatalog(), readSaved()]);
      state.models = models;
      state.loaded = true;
      state.provider = saved.provider && models.some((m) => m.provider === saved.provider)
        ? saved.provider
        : (models[0]?.provider || '');
      state.model = saved.model && models.some((m) => m.provider === state.provider && m.model === saved.model)
        ? saved.model
        : (modelsOf(state.provider)[0]?.model || '');
    }

    fillProviderSelect(providerSelect);
    fillModelSelect(modelSelect);

    providerSelect?.addEventListener('change', () => {
      state.provider = providerSelect.value;
      state.model = modelsOf(state.provider)[0]?.model || '';
      fillModelSelect(modelSelect);
      persist();
      onChange(getSelection());
    });

    modelSelect?.addEventListener('change', () => {
      state.model = modelSelect.value;
      persist();
      onChange(getSelection());
    });

    persist();
    onChange(getSelection());
    return getSelection();
  }

  function getSelection() {
    const found = state.models.find((m) => m.provider === state.provider && m.model === state.model);
    return {
      provider: state.provider,
      model: state.model,
      label: found?.label || state.model,
      count: state.models.length,
    };
  }

  async function loadSelection() {
    if (state.loaded) return getSelection();
    const saved = await readSaved();
    state.provider = saved.provider || '';
    state.model = saved.model || '';
    return getSelection();
  }

  window.MSKModels = { attach, getSelection, loadSelection, providerLabel };
})();
