(() => {
  "use strict";

  const CARD_CLASS = "msk-lovable-edit-card";
  const SHELL_CLASS = "msk-lovable-edit-shell";
  const HEAD_CLASS = "msk-lovable-edit-head";
  const SUMMARY_CLASS = "msk-lovable-edit-summary";
  const ACTIONS_CLASS = "msk-lovable-edit-actions";
  const BRAND_CLASS = "msk-lovable-edit-brand";
  const ACTION_CLASS = "msk-lovable-edit-action";
  const PREVIEW_CLASS = "msk-lovable-edit-preview";
  const DETAILS_CLASS = "msk-lovable-edit-details";
  const HIDDEN_CLASS = "msk-lovable-original-hidden";
  const CONFETTI_CLASS = "msk-lovable-edit-confetti";
  const logoUrl = chrome.runtime.getURL("assets/msk-agente-logo.png");

  const normalize = value => String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");

  const cleanText = value => String(value || "")
    .replace(/\s+/g, " ")
    .replace(/detalhes|details|previewing|preview|visualizando|visualizar/gi, " ")
    .replace(/editado por msk(?:\ssystem)?/gi, " ")
    .replace(/resumo da aplicação/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const isDetailsButton = button => {
    const text = normalize(button?.textContent);
    return text === "detalhes" || text === "details";
  };

  const isPreviewButton = button => {
    const text = normalize(button?.textContent);
    return text === "preview" || text === "previewing" || text === "visualizar" || text === "visualizando";
  };

  const nonActionText = element => cleanText(element?.textContent);

  const findEditCard = detailsButton => {
    if (detailsButton?.closest?.(`.${SHELL_CLASS}`)) return null;
    let current = detailsButton?.parentElement || null;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
      if (current.id === "msk-root") return null;
      if (current.classList?.contains(SHELL_CLASS) || current.closest?.(`.${SHELL_CLASS}`)) return null;
      const buttons = Array.from(current.querySelectorAll(":scope button, button"));
      const detailsCount = buttons.filter(isDetailsButton).length;
      const previewCount = buttons.filter(isPreviewButton).length;
      if (detailsCount === 1 && previewCount >= 1 && nonActionText(current).length >= 5) return current;
    }
    return null;
  };

  const extractSummary = card => {
    const texts = [];
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest(`.${SHELL_CLASS}`)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('button')) return NodeFilter.FILTER_REJECT;
        const text = cleanText(node.textContent);
        if (!text) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    while (walker.nextNode()) {
      const text = cleanText(walker.currentNode.textContent);
      if (text) texts.push(text);
    }

    const seen = new Set();
    const unique = texts.filter(item => {
      const key = item.toLocaleLowerCase('pt-BR');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.join(' • ') || 'Resumo da aplicação disponível.';
  };

  const buildCardSignature = card => {
    const buttons = Array.from(card.querySelectorAll("button")).filter(button => !button.closest(`.${SHELL_CLASS}`));
    const actionTexts = buttons.map(button => normalize(button.textContent)).join("|");
    return `${extractSummary(card)}||${actionTexts}`;
  };

  const buildShell = () => {
    const shell = document.createElement('div');
    shell.className = SHELL_CLASS;
    shell.setAttribute('data-msk-ui', 'edit-card-shell');

    const head = document.createElement('div');
    head.className = HEAD_CLASS;

    const logo = document.createElement('img');
    logo.src = logoUrl;
    logo.alt = 'MSK';
    logo.className = 'msk-lovable-edit-logo';

    const brand = document.createElement('div');
    brand.className = BRAND_CLASS;

    const title = document.createElement('strong');
    title.textContent = 'Editado por MSK';

    const subtitle = document.createElement('span');
    subtitle.textContent = 'Resumo da aplicação';

    brand.append(title, subtitle);
    head.append(logo, brand);

    const summary = document.createElement('div');
    summary.className = SUMMARY_CLASS;

    const actions = document.createElement('div');
    actions.className = ACTIONS_CLASS;

    shell.append(head, summary, actions);
    return shell;
  };

  const celebrateCard = (card, { force = false } = {}) => {
    if (!(card instanceof HTMLElement)) return;
    if (!force && card.dataset.mskCelebrated === "true") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

    card.dataset.mskCelebrated = "true";
    card.querySelector(`:scope > .${CONFETTI_CLASS}`)?.remove();
    const burst = document.createElement("div");
    burst.className = CONFETTI_CLASS;
    burst.setAttribute("aria-hidden", "true");

    const colors = ["#ffffff", "#6dff4b", "#b95cff", "#ffe56b", "#ff8bc7", "#49d7ff"];
    const pieces = 22;
    for (let i = 0; i < pieces; i += 1) {
      const piece = document.createElement("i");
      const angle = ((Math.PI * 2) / pieces) * i + (Math.random() - 0.5) * 0.34;
      const distance = 38 + Math.random() * 46;
      piece.style.setProperty("--msk-confetti-dx", `${Math.cos(angle) * distance}px`);
      piece.style.setProperty("--msk-confetti-dy", `${Math.sin(angle) * distance}px`);
      piece.style.setProperty("--msk-confetti-delay", `${Math.random() * 0.06}s`);
      piece.style.setProperty("--msk-confetti-duration", `${0.78 + Math.random() * 0.28}s`);
      piece.style.setProperty("--msk-confetti-rotate", `${140 + Math.random() * 320}deg`);
      piece.style.setProperty("--msk-confetti-scale", `${0.9 + Math.random() * 0.8}`);
      piece.style.background = colors[i % colors.length];
      burst.append(piece);
    }

    card.append(burst);
    card.classList.remove("msk-lovable-card-arrival");
    void card.offsetWidth;
    card.classList.add("msk-lovable-card-arrival");
    window.setTimeout(() => card.classList.remove("msk-lovable-card-arrival"), 900);
    window.setTimeout(() => burst.remove(), 1350);
  };

  const decorateCard = card => {
    if (!(card instanceof HTMLElement)) return { isNew:false, shouldCelebrate:false };
    card.classList.add(CARD_CLASS);

    let shell = card.querySelector(`:scope > .${SHELL_CLASS}`);
    const isNew = !shell;
    if (!shell) {
      shell = buildShell();
      card.prepend(shell);
    }

    const signatureBefore = card.dataset.mskCardSignature || "";
    const summaryText = extractSummary(card);
    const summary = shell.querySelector(`.${SUMMARY_CLASS}`);
    if (summary) summary.textContent = summaryText;

    const actions = shell.querySelector(`.${ACTIONS_CLASS}`);
    const buttons = Array.from(card.querySelectorAll("button")).filter(button => !button.closest(`.${SHELL_CLASS}`));
    let previewing = false;

    buttons.forEach(button => {
      if (isDetailsButton(button)) {
        button.classList.remove(HIDDEN_CLASS);
        button.removeAttribute("aria-hidden");
        button.classList.add(ACTION_CLASS, DETAILS_CLASS);
        actions?.append(button);
        return;
      }
      if (isPreviewButton(button)) {
        button.classList.remove(HIDDEN_CLASS);
        button.removeAttribute("aria-hidden");
        button.classList.add(ACTION_CLASS, PREVIEW_CLASS);
        const active = normalize(button.textContent) === "previewing" || normalize(button.textContent) === "visualizando";
        button.classList.toggle("msk-lovable-edit-previewing", active);
        previewing ||= active;
        actions?.append(button);
        return;
      }
      button.classList.add(HIDDEN_CLASS);
      button.setAttribute("aria-hidden", "true");
      button.tabIndex = -1;
    });

    Array.from(card.children).forEach(child => {
      if (child === shell || child.classList?.contains(CONFETTI_CLASS)) return;
      child.classList.add(HIDDEN_CLASS);
      child.setAttribute?.("aria-hidden", "true");
    });

    card.classList.toggle("msk-lovable-edit-card-previewing", previewing);
    card.dataset.mskStyled = "true";
    const signatureAfter = buildCardSignature(card);
    const changed = signatureAfter !== signatureBefore;
    card.dataset.mskCardSignature = signatureAfter;
    return { isNew, shouldCelebrate:isNew || changed };
  };

  const resetStaleCards = () => {
    const shells = Array.from(document.querySelectorAll(`.${SHELL_CLASS}`));
    shells.forEach(shell => {
      const card = shell.closest(`.${CARD_CLASS}`) || shell.parentElement;
      if (!(card instanceof HTMLElement)) return;

      const buttons = Array.from(shell.querySelectorAll("button"));
      buttons.forEach(button => {
        button.classList.remove(ACTION_CLASS, DETAILS_CLASS, PREVIEW_CLASS, "msk-lovable-edit-previewing", HIDDEN_CLASS);
        button.removeAttribute("aria-hidden");
        button.removeAttribute("tabindex");
        card.append(button);
      });

      shell.remove();
      card.classList.remove(CARD_CLASS, "msk-lovable-edit-card-previewing");
      card.removeAttribute("data-msk-styled");
      card.removeAttribute("data-msk-celebrated");

      Array.from(card.querySelectorAll(`.${HIDDEN_CLASS}`)).forEach(element => {
        element.classList.remove(HIDDEN_CLASS);
        element.removeAttribute("aria-hidden");
      });
      Array.from(card.querySelectorAll(`.${CONFETTI_CLASS}`)).forEach(element => element.remove());
    });
  };

  let initialScanDone = false;
  const scan = () => {
    const detailsButtons = Array.from(document.querySelectorAll("button")).filter(button => isDetailsButton(button) && !button.closest(`.${SHELL_CLASS}`));
    const cards = [];
    const seen = new Set();
    detailsButtons.forEach(button => {
      const card = findEditCard(button);
      if (card && !seen.has(card)) {
        seen.add(card);
        cards.push(card);
      }
    });

    const cardsToCelebrate = [];
    cards.forEach(card => {
      const result = decorateCard(card) || { isNew:false, shouldCelebrate:false };
      if (result.shouldCelebrate) cardsToCelebrate.push({ card, force:!result.isNew });
    });

    if (cardsToCelebrate.length) {
      cardsToCelebrate.forEach(({ card, force }) => celebrateCard(card, { force }));
    }
    initialScanDone = true;
  };

  let scanFrame = 0;
  let microtaskQueued = false;
  const scheduleScan = () => {
    // Primeiro tenta ainda no mesmo ciclo de renderização para evitar o "flash"
    // do card nativo. O requestAnimationFrame consolida mutações em lote sem pesar.
    if (!microtaskQueued) {
      microtaskQueued = true;
      queueMicrotask(() => {
        microtaskQueued = false;
        scan();
      });
    }
    if (!scanFrame) {
      scanFrame = requestAnimationFrame(() => {
        scanFrame = 0;
        scan();
      });
    }
  };

  const observer = new MutationObserver(mutations => {
    const relevant = mutations.some(mutation => {
      if (mutation.type === 'characterData') return true;
      return Array.from(mutation.addedNodes || []).some(node => {
        if (!(node instanceof Element)) return false;
        if (node.classList?.contains(SHELL_CLASS)) return false;
        return node.matches?.('button') || node.querySelector?.('button');
      });
    });
    if (relevant) scheduleScan();
  });

  let started = false;
  const start = () => {
    if (started) return;
    const target = document.documentElement;
    if (!target) {
      requestAnimationFrame(start);
      return;
    }
    started = true;
    // Observa antes da primeira pintura útil do card para aplicar a identidade MSK
    // assim que os controles Detalhes/Preview entram no DOM.
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true
    });
    resetStaleCards();
    scan();
  };

  start();
})();
