(() => {
  'use strict';
  if (window.__MSK_MULTIMODAL_V1__) return;
  window.__MSK_MULTIMODAL_V1__ = true;

  const MAX_ATTACHMENTS = 8;
  const MAX_TEXT_CHARS = 220000;
  const MAX_DATA_URL_CHARS = 5500000;
  const MAX_TOTAL_DATA_URL_CHARS = 12000000;
  const state = { items: [], busy: 0 };

  const humanSize = bytes => {
    const n = Number(bytes || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  const id = () => `att_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  const ext = name => String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
  const textLike = file => {
    const e = ext(file.name);
    return String(file.type || '').startsWith('text/') || [
      'txt','md','markdown','json','jsonl','csv','tsv','log','xml','yaml','yml','toml','ini','env','sql',
      'js','jsx','ts','tsx','mjs','cjs','css','scss','sass','less','html','htm','vue','svelte','py','rb','php',
      'java','kt','kts','go','rs','swift','c','h','cpp','hpp','cs','sh','bash','zsh','ps1','graphql','gql'
    ].includes(e);
  };

  const supported = file => {
    const mime = String(file.type || '').toLowerCase();
    const e = ext(file.name);
    return textLike(file) || mime.startsWith('image/') || mime.startsWith('audio/') || mime === 'application/pdf' || e === 'pdf' || e === 'docx';
  };

  const kindFor = file => {
    const mime = String(file.type || '').toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime === 'application/pdf' || ext(file.name) === 'pdf') return 'pdf';
    if (ext(file.name) === 'docx') return 'document';
    return 'text';
  };

  const readDataUrl = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('FILE_READ_FAILED'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });

  const readDocx = async file => {
    if (!globalThis.JSZip) throw new Error('DOCX_READER_UNAVAILABLE');
    const zip = await globalThis.JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file('word/document.xml')?.async('string');
    if (!xml) throw new Error('DOCX_INVALID');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const paragraphs = [...doc.getElementsByTagName('w:p')].map(p =>
      [...p.getElementsByTagName('w:t')].map(n => n.textContent || '').join('')
    ).filter(Boolean);
    return paragraphs.join('\n').slice(0, MAX_TEXT_CHARS);
  };

  const compressImage = async file => {
    if (file.size <= 1200000) return readDataUrl(file);
    try {
      const bitmap = await createImageBitmap(file);
      const maxSide = 1800;
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('CANVAS_UNAVAILABLE');
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close?.();
      const dataUrl = canvas.toDataURL('image/webp', 0.84);
      return dataUrl.length <= MAX_DATA_URL_CHARS ? dataUrl : canvas.toDataURL('image/jpeg', 0.72);
    } catch {
      return readDataUrl(file);
    }
  };

  const readFile = async file => {
    const kind = kindFor(file);
    const item = {
      id: id(),
      name: String(file.name || 'anexo').slice(0, 180),
      mime: String(file.type || (kind === 'pdf' ? 'application/pdf' : 'application/octet-stream')).slice(0, 120),
      kind,
      size: Number(file.size || 0),
      status: 'reading',
      text: '',
      data_url: '',
    };
    state.items.push(item);
    render();
    try {
      if (textLike(file)) {
        item.text = String(await file.text()).replace(/\u0000/g, '').slice(0, MAX_TEXT_CHARS);
      } else if (kind === 'document') {
        item.text = await readDocx(file);
        item.mime = item.mime || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (kind === 'image') {
        item.data_url = await compressImage(file);
        item.mime = item.data_url.startsWith('data:image/webp') ? 'image/webp' : item.mime;
      } else {
        item.data_url = await readDataUrl(file);
      }
      if (item.data_url.length > MAX_DATA_URL_CHARS) throw new Error('ATTACHMENT_TOO_LARGE');
      item.status = 'ready';
    } catch (error) {
      item.status = 'error';
      item.error = error?.message === 'ATTACHMENT_TOO_LARGE'
        ? 'Arquivo grande demais para leitura segura.'
        : error?.message === 'DOCX_READER_UNAVAILABLE'
          ? 'Leitor DOCX indisponível nesta página.'
          : 'Não foi possível preparar este arquivo.';
    }
    render();
    return item;
  };

  const addFiles = async files => {
    const list = [...(files || [])].filter(Boolean);
    const remaining = MAX_ATTACHMENTS - state.items.length;
    for (const file of list.slice(0, Math.max(0, remaining))) {
      if (!supported(file)) {
        toast(`Formato não suportado: ${file.name || 'arquivo'}`, true);
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast(`${file.name}: limite de 8 MB por arquivo.`, true);
        continue;
      }
      state.busy += 1;
      readFile(file).finally(() => { state.busy = Math.max(0, state.busy - 1); render(); });
    }
  };

  let tray = null;
  let inputEl = null;
  let attachButton = null;

  const toast = (text, error = false) => {
    const root = document.querySelector('#msk-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `msk-mm-toast${error ? ' error' : ''}`;
    el.textContent = text;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 200); }, 2400);
  };

  const render = () => {
    if (!tray) return;
    tray.replaceChildren();
    tray.hidden = state.items.length === 0;
    for (const item of state.items) {
      const chip = document.createElement('article');
      chip.className = `msk-mm-chip ${item.status || 'reading'}`;
      chip.dataset.id = item.id;
      const icon = document.createElement('span');
      icon.className = 'msk-mm-icon';
      icon.textContent = item.kind === 'image' ? 'IMG' : item.kind === 'audio' ? 'AUD' : item.kind === 'pdf' ? 'PDF' : item.kind === 'document' ? 'DOC' : 'FILE';
      const info = document.createElement('span');
      info.className = 'msk-mm-info';
      const strong = document.createElement('strong');
      strong.textContent = item.name;
      const small = document.createElement('small');
      small.textContent = item.status === 'reading' ? 'Preparando…' : item.status === 'error' ? (item.error || 'Falha') : `${humanSize(item.size)} · pronto para leitura`;
      info.append(strong, small);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'msk-mm-remove';
      remove.title = 'Remover anexo';
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        state.items = state.items.filter(x => x.id !== item.id);
        render();
      });
      chip.append(icon, info, remove);
      tray.appendChild(chip);
    }
  };

  const installUi = () => {
    const root = document.querySelector('#msk-root');
    const compose = root?.querySelector('.msk-compose');
    if (!root || !compose) return false;
    if (compose.querySelector('.msk-mm-attach')) return true;

    attachButton = document.createElement('button');
    attachButton.type = 'button';
    attachButton.className = 'msk-icon msk-mm-attach';
    attachButton.title = 'Anexar imagem, áudio ou arquivo';
    attachButton.setAttribute('aria-label', 'Anexar imagem, áudio ou arquivo');
    attachButton.textContent = '＋';

    inputEl = document.createElement('input');
    inputEl.type = 'file';
    inputEl.multiple = true;
    inputEl.hidden = true;
    inputEl.accept = 'image/*,audio/*,application/pdf,.pdf,.docx,.txt,.md,.json,.jsonl,.csv,.tsv,.log,.xml,.yaml,.yml,.toml,.ini,.sql,.js,.jsx,.ts,.tsx,.mjs,.cjs,.css,.scss,.html,.htm,.py,.php,.java,.go,.rs,.sh,.graphql,.gql';

    tray = document.createElement('div');
    tray.className = 'msk-mm-tray';
    tray.hidden = true;
    compose.parentNode?.insertBefore(tray, compose);

    const mic = compose.querySelector('.msk-mic');
    if (mic) mic.insertAdjacentElement('afterend', attachButton);
    else compose.prepend(attachButton);
    compose.appendChild(inputEl);

    attachButton.addEventListener('click', event => { event.preventDefault(); inputEl.click(); });
    inputEl.addEventListener('change', () => { addFiles(inputEl.files); inputEl.value = ''; });

    const onDrag = event => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      event.preventDefault();
      root.classList.add('msk-mm-dragging');
    };
    root.addEventListener('dragover', onDrag, true);
    root.addEventListener('dragleave', () => root.classList.remove('msk-mm-dragging'), true);
    root.addEventListener('drop', event => {
      if (!event.dataTransfer?.files?.length) return;
      event.preventDefault();
      event.stopPropagation();
      root.classList.remove('msk-mm-dragging');
      addFiles(event.dataTransfer.files);
    }, true);

    const textInput = compose.querySelector('.msk-input');
    textInput?.addEventListener('paste', event => {
      const files = [...(event.clipboardData?.files || [])];
      if (!files.length) return;
      event.preventDefault();
      addFiles(files);
    }, true);
    return true;
  };

  const waitUi = setInterval(() => { if (installUi()) clearInterval(waitUi); }, 250);
  setTimeout(() => clearInterval(waitUi), 20000);

  window.__MSK_MULTIMODAL__ = {
    has: () => state.items.some(x => x.status === 'ready'),
    busy: () => state.busy > 0 || state.items.some(x => x.status === 'reading'),
    peek: () => state.items.filter(x => x.status === 'ready').map(x => ({
      id: x.id, name: x.name, mime: x.mime, kind: x.kind, size: x.size,
      ...(x.text ? { text: x.text } : {}),
      ...(x.data_url ? { data_url: x.data_url } : {}),
    })),
    clear: () => { state.items = []; render(); },
    count: () => state.items.filter(x => x.status === 'ready').length,
    totalDataChars: () => state.items.reduce((sum, x) => sum + String(x.data_url || '').length, 0),
    validate: () => {
      const ready = state.items.filter(x => x.status === 'ready');
      if (ready.length > MAX_ATTACHMENTS) return { ok: false, error: `Use no máximo ${MAX_ATTACHMENTS} anexos por mensagem.` };
      const total = ready.reduce((sum, x) => sum + String(x.data_url || '').length, 0);
      if (total > MAX_TOTAL_DATA_URL_CHARS) return { ok: false, error: 'Os anexos ficaram grandes demais juntos. Envie menos arquivos por vez.' };
      if (state.items.some(x => x.status === 'reading')) return { ok: false, pending: true, error: 'Ainda estou preparando um dos anexos.' };
      if (state.items.some(x => x.status === 'error')) return { ok: false, error: 'Remova ou substitua o anexo que não pôde ser lido.' };
      return { ok: true };
    },
  };
})();