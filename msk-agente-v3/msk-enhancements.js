/* MSK Agente — camada visual: créditos infinitos, sino de mensagens e usuários ativos.
   Escopo restrito: só altera o bloco de créditos do Lovable e o cabeçalho do painel MSK. */
(() => {
  "use strict";
  if (window.__mskEnhancements) return;
  window.__mskEnhancements = true;

  const STORE_USERS = "mskActiveUsersState";
  const STORE_READ = "mskRemoteReadIds";

  /* ---------------- licença ---------------- */
  let licenseActive = false;
  const licenseIsActive = license => {
    if (!license) return false;
    if (license.status && String(license.status) !== "active") return false;
    if (license.expires_at && Date.parse(license.expires_at) <= Date.now()) return false;
    return true;
  };
  const readLicense = async () => {
    try {
      const stored = await chrome.storage.local.get("mskLicense");
      licenseActive = licenseIsActive(stored?.mskLicense);
    } catch {
      licenseActive = false;
    }
    applyCredits();
  };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.mskLicense) readLicense();
  });

  /* ---------------- créditos do Lovable: barra neon + ∞ ---------------- */
  const CREDIT_LABEL = /^(credits?|cr[ée]ditos?)$/i;
  const CREDIT_VALUE = /^\s*[\d.,]+\s*(left|restantes?|remaining)?\s*$/i;

  const creditsContainer = () => {
    const labels = [...document.querySelectorAll("span,div,p,h1,h2,h3,h4,strong,b,label")].filter(
      el => el.children.length === 0 && CREDIT_LABEL.test((el.textContent || "").trim()),
    );
    for (const label of labels) {
      let node = label;
      for (let i = 0; i < 5 && node; i += 1) {
        node = node.parentElement;
        if (!node) break;
        const bar =
          node.querySelector('[role="progressbar"]') ||
          [...node.querySelectorAll("div")].find(div => {
            const rect = div.getBoundingClientRect();
            return rect.width > 60 && rect.height > 2 && rect.height <= 16;
          });
        if (bar) return { root: node, label, bar };
      }
    }
    return null;
  };

  const restoreCredits = () => {
    document.querySelectorAll("[data-msk-credit-original]").forEach(el => {
      el.textContent = el.getAttribute("data-msk-credit-original") || el.textContent;
      el.removeAttribute("data-msk-credit-original");
      el.classList.remove("msk-credit-infinity");
    });
    document.querySelectorAll(".msk-credit-bar").forEach(el => el.classList.remove("msk-credit-bar"));
    document.querySelectorAll(".msk-credit-fill").forEach(el => {
      el.classList.remove("msk-credit-fill");
      if (el.dataset.mskFillWidth !== undefined) {
        el.style.width = el.dataset.mskFillWidth;
        delete el.dataset.mskFillWidth;
      }
    });
  };

  let applying = false;
  const applyCredits = () => {
    if (applying) return;
    applying = true;
    try {
      if (!licenseActive) {
        restoreCredits();
        return;
      }
      const found = creditsContainer();
      if (!found) return;

      // Todos os valores de crédito (inclui "0 left" do plano Pro) -> ∞ pulsante.
      [...found.root.querySelectorAll("span,div,p,strong,b")]
        .filter(el => el.children.length === 0 && CREDIT_VALUE.test(el.textContent || ""))
        .forEach(el => {
          if (el.hasAttribute("data-msk-credit-original")) return;
          el.setAttribute("data-msk-credit-original", el.textContent || "");
          el.textContent = "∞";
          el.classList.add("msk-credit-infinity");
        });

      // Apenas a(s) barra(s) originais do Lovable — sem criar/duplicar barras.
      const candidates = [...found.root.querySelectorAll('[role="progressbar"]')];
      const bars = candidates.length ? candidates : [found.bar];
      bars.forEach(bar => {
        if (!bar || !bar.isConnected) return;
        // se um ancestral já foi estilizado, não estiliza de novo (evita barra dupla)
        if (bar.parentElement?.closest(".msk-credit-bar")) return;
        bar.classList.add("msk-credit-bar");
        const fill = bar.querySelector("div") || bar;
        if (fill.dataset.mskFillWidth === undefined) fill.dataset.mskFillWidth = fill.style.width || "";
        fill.classList.add("msk-credit-fill");
        fill.style.width = "100%";
      });
    } finally {
      applying = false;
    }
  };

  let creditTimer = 0;
  const scheduleCredits = () => {
    clearTimeout(creditTimer);
    creditTimer = window.setTimeout(applyCredits, 180);
  };
  new MutationObserver(scheduleCredits).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(applyCredits, 2500);

  /* ---------------- sino de mensagens do painel MSK ---------------- */
  let messages = [];
  let readIds = new Set();
  const ackedIds = new Set();
  let bellWrap = null;
  let bellButton = null;
  let bellBadge = null;
  let bellList = null;
  let bellOpen = false;

  const timeLabel = value => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const unreadCount = () => messages.filter(item => !readIds.has(String(item.id))).length;

  const renderBell = () => {
    if (!bellBadge || !bellList) return;
    const unread = unreadCount();
    bellBadge.textContent = unread > 99 ? "99+" : String(unread);
    bellBadge.style.display = unread > 0 ? "grid" : "none";
    if (unread > 0) {
      bellButton.classList.add("ring");
      setTimeout(() => bellButton?.classList.remove("ring"), 1200);
    }
    bellList.innerHTML = messages.length
      ? messages
          .map(
            item => `
        <article class="msk-bell-item ${readIds.has(String(item.id)) ? "" : "unread"} ${String(item.severity || "info")}">
          <header><strong></strong><time></time></header>
          <p></p>
        </article>`,
          )
          .join("")
      : '<p class="msk-bell-empty">Nenhuma mensagem do painel MSK ainda.</p>';
    [...bellList.querySelectorAll(".msk-bell-item")].forEach((node, index) => {
      const item = messages[index];
      node.querySelector("strong").textContent = String(item?.title || "Mensagem MSK");
      node.querySelector("time").textContent = timeLabel(item?.created_at);
      node.querySelector("p").textContent = String(item?.message || "");
    });
  };

  const markAllRead = () => {
    messages.forEach(item => {
      const id = String(item.id);
      if (!readIds.has(id)) {
        chrome.runtime.sendMessage({ type: "MSK_REMOTE_ACK", id }, () => void chrome.runtime.lastError);
      }
      readIds.add(id);
    });
    chrome.storage.local.set({ [STORE_READ]: [...readIds].slice(-300) }).catch(() => {});
    renderBell();
  };

  const buildBell = host => {
    if (bellWrap && document.contains(bellWrap)) return;
    bellWrap = document.createElement("div");
    bellWrap.className = "msk-bell-wrap";
    bellWrap.innerHTML = `
      <button type="button" class="msk-bell-btn" title="Mensagens da MSK" aria-label="Mensagens da MSK">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
        <span class="msk-bell-badge" style="display:none">0</span>
      </button>`;
    host.prepend(bellWrap);
    const overlay = document.createElement("div");
    overlay.className = "msk-bell-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="msk-bell-panel" role="dialog" aria-label="Mensagens MSK">
        <header><b>Mensagens MSK</b><button type="button" class="msk-bell-close" aria-label="Fechar">×</button></header>
        <div class="msk-bell-list"></div>
      </div>`;
    (document.querySelector("#msk-root") || document.body).appendChild(overlay);
    bellButton = bellWrap.querySelector(".msk-bell-btn");
    bellBadge = bellWrap.querySelector(".msk-bell-badge");
    bellList = overlay.querySelector(".msk-bell-list");
    const panel = overlay;
    bellButton.addEventListener("click", event => {
      event.stopPropagation();
      bellOpen = !bellOpen;
      panel.hidden = !bellOpen;
      if (bellOpen) markAllRead();
    });
    overlay.querySelector(".msk-bell-close").addEventListener("click", () => {
      bellOpen = false;
      panel.hidden = true;
    });
    overlay.addEventListener("click", event => {
      if (event.target !== overlay) return;
      bellOpen = false;
      panel.hidden = true;
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && bellOpen) {
        bellOpen = false;
        panel.hidden = true;
      }
    });
    renderBell();
  };

  const pullMessages = () => {
    chrome.runtime.sendMessage({ type: "MSK_REMOTE_PULL" }, response => {
      void chrome.runtime.lastError;
      if (!response?.ok || !Array.isArray(response.commands)) return;
      const allowed = new Set(["message", "update_notice", "block", "unblock", "diagnostic", "revalidate_license", "clear_cache", "refresh"]);
      const incoming = response.commands
        .filter(item => {
          const kind = item.command_type || item.type;
          return !kind || allowed.has(kind);
        })
        .map(item => ({
          id: item.id,
          title: item.title,
          message: item.message,
          severity: item.severity,
          created_at: item.created_at,
        }));
      const known = new Map(messages.map(item => [String(item.id), item]));
      incoming.forEach(item => {
        const id = String(item.id);
        if (!known.has(id) && !ackedIds.has(id)) {
          ackedIds.add(id);
          chrome.runtime.sendMessage({ type: "MSK_REMOTE_ACK", id }, () => void chrome.runtime.lastError);
        }
        known.set(id, item);
      });
      messages = [...known.values()]
        .sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0))
        .slice(0, 60);
      renderBell();
    });
  };

  /* ---------------- usuários ativos (👥) — presença real ---------------- */
  let usersValue = 0; // último valor válido conhecido (nunca zera na tela)
  let usersChip = null;

  const renderUsers = () => {
    if (!usersChip) return;
    const el = usersChip.querySelector("b");
    const next = usersValue > 0 ? String(usersValue) : "—";
    if (el.textContent === next) return;
    el.textContent = next;
    // Animação discreta (fade + leve scale), sem piscar.
    el.classList.remove("msk-users-bump");
    void el.offsetWidth;
    el.classList.add("msk-users-bump");
  };

  const persistUsers = () => {
    chrome.storage.local
      .set({ [STORE_USERS]: { value: usersValue, at: Date.now() } })
      .catch(() => {});
  };

  const setUsers = value => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return; // erro/carregando: mantém o último válido
    usersValue = Math.round(n);
    renderUsers();
    persistUsers();
  };

  const buildUsersChip = host => {
    if (usersChip && document.contains(usersChip)) return;
    usersChip = document.createElement("span");
    usersChip.className = "msk-users-chip";
    usersChip.title = "Presença ativa agora";
    usersChip.innerHTML = '<span class="msk-users-live"></span><span class="msk-users-emoji">👥</span><b>—</b>';
    host.prepend(usersChip);
    renderUsers();
  };



  /* ---------------- popup central + baixar projeto ---------------- */
  let toastTimer = 0;
  const showToast = (title, detail, tone = "ok") => {
    const panel = document.querySelector("#msk-root");
    if (!panel) return;
    panel.querySelector(".msk-center-toast")?.remove();
    const toast = document.createElement("div");
    toast.className = `msk-center-toast ${tone}`;
    toast.innerHTML = '<span class="msk-center-dot"></span><strong></strong><small></small>';
    toast.querySelector("strong").textContent = title;
    toast.querySelector("small").textContent = detail || "";
    panel.appendChild(toast);
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.add("out");
      setTimeout(() => toast.remove(), 420);
    }, 3200);
  };

  const projectContext = () => {
    const fromUrl = (location.pathname.match(/\/projects\/([0-9a-f-]{8,})/i) || [])[1] || "";
    const id = (document.querySelector("#msk-root .msk-project-id")?.textContent || "").trim();
    const github = document.querySelector('#msk-root [data-sync="github"]')?.textContent || "";
    const repo = (github.split("·")[1] || "").trim();
    return { projectId: /^[0-9a-f-]{8,}$/i.test(id) ? id : fromUrl, repo };
  };

  let downloadBtn = null;
  const buildDownloadButton = () => {
    if (downloadBtn && document.contains(downloadBtn)) return;
    const host = document.querySelector("#msk-root .msk-auto-actions");
    if (!host) return;
    downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "msk-download-project";
    downloadBtn.title = "Baixar o projeto completo em ZIP";
    downloadBtn.innerHTML = `<img src="${chrome.runtime.getURL("assets/msk-download.png")}" alt=""><span>Baixar projeto (ZIP)</span>`;
    host.appendChild(downloadBtn);
    const setState = (state, label) => {
      downloadBtn.dataset.state = state;
      const text = downloadBtn.querySelector("span");
      if (text) text.textContent = label;
    };
    let busy = false;
    downloadBtn.addEventListener("click", () => {
      if (busy) return;
      busy = true;
      const ctx = projectContext();
      downloadBtn.disabled = true;
      setState("preparing", "Preparando projeto...");
      showToast("Preparando projeto...", ctx.projectId ? `Projeto ${ctx.projectId.slice(0, 8)}` : "Projeto atual");
      chrome.runtime.sendMessage({ type: "MSK_DOWNLOAD_PROJECT", payload: ctx }, response => {
        void chrome.runtime.lastError;
        busy = false;
        downloadBtn.disabled = false;
        if (response?.ok) {
          setState("done", "Baixado");
          showToast("Projeto baixado com sucesso", response.filename || "ZIP completo do repositório.");
        } else {
          const code = response?.code || "DOWNLOAD_FAILED";
          const messages = {
            GITHUB_NOT_CONNECTED: "Conecte o GitHub primeiro.",
            PROJECT_NOT_FOUND: "Abra o projeto no Lovable e tente novamente.",
            REPOSITORY_NOT_FOUND: "Este projeto ainda não está conectado a um repositório GitHub.",
            DOWNLOAD_FAILED: "Não foi possível preparar o projeto.",
          };
          setState("error", "Baixar projeto (ZIP)");
          showToast("Download não concluído", response?.message || messages[code] || messages.DOWNLOAD_FAILED, "warn");
        }
        setTimeout(() => setState("idle", "Baixar projeto (ZIP)"), 2600);
      });
    });
  };

  /* ---------------- montagem no painel MSK ---------------- */
  const mount = () => {
    const host = document.querySelector("#msk-root .msk-head-actions");
    if (!host) return;
    buildBell(host);
    buildUsersChip(host);
    buildDownloadButton();
  };

  const initUsers = async () => {
    try {
      const stored = await chrome.storage.local.get(STORE_USERS);
      const saved = stored?.[STORE_USERS];
      if (Number(saved?.value) > 0) usersValue = Math.round(Number(saved.value));
    } catch {}
    renderUsers();

    const pullReal = () =>
      chrome.runtime.sendMessage({ type: "MSK_ACTIVE_USERS" }, response => {
        void chrome.runtime.lastError;
        if (typeof response?.active === "number") setUsers(response.active);
      });
    pullReal();
    setInterval(pullReal, 30000);
  };



  const boot = async () => {
    try {
      const stored = await chrome.storage.local.get(STORE_READ);
      readIds = new Set(Array.isArray(stored?.[STORE_READ]) ? stored[STORE_READ].map(String) : []);
    } catch {}
    setInterval(mount, 2000);
    mount();
    await readLicense();
    await initUsers();
    pullMessages();
    setInterval(pullMessages, 15000);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
