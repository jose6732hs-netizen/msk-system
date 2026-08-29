(() => {
  "use strict";
  if (window.__MSK_CUSTOM_SKILLS_3423__) return;
  window.__MSK_CUSTOM_SKILLS_3423__ = true;

  const STORE = "mskCustomSkillsByUser";
  const root = () => document.querySelector("#msk-root");
  const skillsHost = () => root()?.querySelector(".msk-skills");

  const accountKey = () => {
    const value = (root()?.querySelector(".msk-account-email")?.textContent || "").trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : "local-device";
  };

  const loadStore = async () => {
    try {
      const data = await chrome.storage.local.get(STORE);
      return data?.[STORE] && typeof data[STORE] === "object" ? data[STORE] : {};
    } catch {
      return {};
    }
  };

  const saveStore = async value => {
    await chrome.storage.local.set({ [STORE]: value });
  };

  const getSkills = async () => {
    const all = await loadStore();
    const list = all[accountKey()];
    return Array.isArray(list) ? list : [];
  };

  const setSkills = async list => {
    const all = await loadStore();
    all[accountKey()] = list.slice(0, 50);
    await saveStore(all);
  };

  const useSkill = prompt => {
    const host = root();
    const input = host?.querySelector(".msk-input");
    if (!host || !input) return;
    input.value = String(prompt || "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    host.querySelector('[data-tab="chat"]')?.click();
    input.focus();
    try { input.setSelectionRange(input.value.length, input.value.length); } catch {}
  };

  let modal = null;
  const closeModal = () => {
    modal?.remove();
    modal = null;
  };

  const openModal = () => {
    const host = root()?.querySelector(".msk-panel");
    if (!host || modal) return;

    modal = document.createElement("div");
    modal.className = "msk-custom-skill-modal";
    modal.innerHTML = `
      <div class="msk-custom-skill-box" role="dialog" aria-modal="true" aria-label="Criar Skill individual">
        <div class="msk-custom-skill-head">
          <div><strong>Criar Skill</strong><small>Individual · salva somente para esta conta</small></div>
          <button type="button" class="msk-custom-skill-close" aria-label="Fechar">×</button>
        </div>
        <label>Nome da Skill<input class="msk-custom-skill-name" maxlength="42" placeholder="Ex.: Melhorar checkout"></label>
        <label>Comando da Skill<textarea class="msk-custom-skill-prompt" rows="6" maxlength="4000" placeholder="Descreva exatamente o que a IA deve fazer quando você usar esta Skill."></textarea></label>
        <div class="msk-custom-skill-actions">
          <button type="button" class="msk-custom-skill-cancel">Cancelar</button>
          <button type="button" class="msk-custom-skill-save">Salvar Skill</button>
        </div>
        <span class="msk-custom-skill-error" hidden></span>
      </div>`;
    host.appendChild(modal);

    const name = modal.querySelector(".msk-custom-skill-name");
    const prompt = modal.querySelector(".msk-custom-skill-prompt");
    const error = modal.querySelector(".msk-custom-skill-error");
    name.focus();

    modal.querySelector(".msk-custom-skill-close").addEventListener("click", closeModal);
    modal.querySelector(".msk-custom-skill-cancel").addEventListener("click", closeModal);
    modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });

    modal.querySelector(".msk-custom-skill-save").addEventListener("click", async () => {
      const skillName = name.value.trim();
      const skillPrompt = prompt.value.trim();
      if (!skillName || !skillPrompt) {
        error.textContent = "Preencha o nome e o comando da Skill.";
        error.hidden = false;
        return;
      }
      const list = await getSkills();
      list.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: skillName,
        prompt: skillPrompt,
        createdAt: Date.now()
      });
      await setSkills(list);
      closeModal();
      await render();
    });
  };

  const removeSkill = async id => {
    const list = await getSkills();
    await setSkills(list.filter(item => item.id !== id));
    await render();
  };

  const render = async () => {
    const host = skillsHost();
    if (!host) return;

    let block = host.querySelector(".msk-custom-skills-block");
    if (!block) {
      block = document.createElement("div");
      block.className = "msk-custom-skills-block";
      block.innerHTML = `
        <div class="msk-section-label msk-custom-skills-title">Minhas Skills <small>INDIVIDUAL</small></div>
        <button type="button" class="msk-create-skill-btn"><b>＋</b><span><strong>Criar Skill</strong><small>Crie seu próprio comando reutilizável</small></span></button>
        <div class="msk-custom-skills-list"></div>`;
      host.appendChild(block);
      block.querySelector(".msk-create-skill-btn").addEventListener("click", openModal);
    }

    const listHost = block.querySelector(".msk-custom-skills-list");
    const list = await getSkills();
    listHost.replaceChildren();

    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "msk-custom-skills-empty";
      empty.textContent = "Nenhuma Skill individual criada ainda.";
      listHost.appendChild(empty);
      return;
    }

    list.forEach(item => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "msk-skill-card msk-custom-skill-card";
      card.title = item.prompt || item.name;

      const icon = document.createElement("span");
      icon.className = "msk-custom-skill-icon";
      icon.textContent = "✦";
      const copy = document.createElement("span");
      copy.className = "msk-custom-skill-copy";
      const title = document.createElement("strong");
      title.textContent = item.name || "Skill";
      const meta = document.createElement("small");
      meta.textContent = "Minha Skill";
      copy.append(title, meta);
      const remove = document.createElement("span");
      remove.className = "msk-custom-skill-remove";
      remove.title = "Excluir Skill";
      remove.setAttribute("role", "button");
      remove.setAttribute("aria-label", `Excluir ${item.name || "Skill"}`);
      remove.textContent = "×";

      remove.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await removeSkill(item.id);
      });
      card.addEventListener("click", () => useSkill(item.prompt));
      card.append(icon, copy, remove);
      listHost.appendChild(card);
    });
  };

  let lastAccount = "";
  const mount = async () => {
    if (!skillsHost()) return;
    const current = accountKey();
    if (!skillsHost().querySelector(".msk-custom-skills-block") || current !== lastAccount) {
      lastAccount = current;
      await render();
    }
  };

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && modal) closeModal();
  });

  setInterval(mount, 900);
  mount();
})();
