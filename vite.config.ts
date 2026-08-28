// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import type { Plugin } from "vite";
import { loadEnv } from "vite";
import path from "node:path";

// Load non-VITE_ env vars (e.g. LOVABLE_API_KEY, SUPABASE_SERVICE_ROLE_KEY) into
// process.env for server routes only. Never added to client define block.
Object.assign(process.env, loadEnv(process.env["NODE_ENV"] || "development", process.cwd(), ""));

/**
 * O teste gratuito e recorrente: dura 15 minutos e pode ser solicitado novamente
 * depois do cooldown configurado (24h). O histórico continua registrado para
 * auditoria, mas não existe mais teto permanente de "uma vez por usuário".
 * IP, device_hash e installation_id não participam da decisão de elegibilidade.
 */
function recurringTrialCooldownFix(): Plugin {
  return {
    name: "msk-recurring-trial-cooldown-fix",
    enforce: "pre",
    transform(code, id) {
      if (!id.replace(/\\/g, "/").includes("/src/lib/commerce.server.ts")) return null;

      const permanentLimit = [
        "  const used = previous?.length ?? 0;",
        '  if (used >= cfg.max_per_user) throw new Error("Você já utilizou o teste gratuito disponível.");',
        "",
      ].join("\n");

      const next = code.replace(permanentLimit, "");
      return next === code ? null : { code: next, map: null };
    },
  };
}

/**
 * Todos os uploads do CMS passam por uma rota protegida que exige o JWT da
 * sessão de Admin/Super Admin. Os componentes antigos enviavam apenas o FormData,
 * então a API respondia 401 e nenhuma imagem de plano/banner era persistida.
 *
 * Mantemos a rota protegida e corrigimos somente os callers, anexando o bearer
 * token atual sem expor service-role nem transformar o upload em endpoint público.
 */
function adminCmsUploadAuthFix(): Plugin {
  return {
    name: "msk-admin-cms-upload-auth-fix",
    enforce: "pre",
    transform(code, id) {
      const normalized = id.replace(/\\/g, "/");
      const isUploadUi =
        normalized.includes("/src/components/msk/admin-editor.tsx") ||
        normalized.includes("/src/components/msk/admin-subscriptions.tsx");
      if (!isUploadUi || !code.includes('fetch("/api/public/cms/upload"')) return null;

      let next = code;
      const supabaseImport = 'import { supabase } from "@/integrations/supabase/client";';
      const helper = `async function mskCmsUploadFetch(input: RequestInfo | URL, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sessão expirada. Entre novamente para enviar imagens.");

  const headers = new Headers(init?.headers);
  headers.set("Authorization", \`Bearer \${accessToken}\`);
  return fetch(input, { ...init, headers });
}`;

      if (!next.includes(supabaseImport)) next = `${supabaseImport}\n${next}`;
      if (!next.includes("async function mskCmsUploadFetch")) next = `${helper}\n\n${next}`;
      next = next.replaceAll(
        'fetch("/api/public/cms/upload"',
        'mskCmsUploadFetch("/api/public/cms/upload"',
      );

      return next === code ? null : { code: next, map: null };
    },
  };
}

/**
 * Evita ícone de imagem quebrada na página de ofertas. Um banner externo inválido
 * é ocultado e mantém o fundo/gradiente do card; imagem inválida de plano cai para
 * o card local embutido no bundle. Uploads válidos continuam sendo usados normalmente.
 */
function plansImageFallbackFix(): Plugin {
  return {
    name: "msk-plans-image-fallback-fix",
    enforce: "pre",
    transform(code, id) {
      if (!id.replace(/\\/g, "/").includes("/src/routes/planos.tsx")) return null;

      let next = code;
      next = next.replace(
        '            src={bannerUrl}\n            alt={`Banner ${title}`}\n            loading="lazy"\n            className="absolute inset-0 h-full w-full object-cover"',
        '            src={bannerUrl}\n            alt={`Banner ${title}`}\n            loading="lazy"\n            className="absolute inset-0 h-full w-full object-cover"\n            onError={(event) => { event.currentTarget.style.display = "none"; }}',
      );
      next = next.replace(
        '                    src={planImage(plan)}\n                    alt={plan.name}\n                    loading="lazy"\n                    className="h-full w-full object-cover"',
        '                    src={planImage(plan)}\n                    alt={plan.name}\n                    loading="lazy"\n                    className="h-full w-full object-cover"\n                    onError={(event) => { if (!event.currentTarget.src.endsWith("/card-free.jpg")) event.currentTarget.src = cardFreeImg; }}',
      );

      return next === code ? null : { code: next, map: null };
    },
  };
}

/**
 * Compatibilidade do editor CMS.
 *
 * O admin-editor antigo só renderiza preview para Hero e Parceiros. Nas demais
 * etapas o painel fica totalmente preto, apesar de localSettings conter os dados
 * reais e estar sendo atualizado a cada tecla. Mantemos a tela existente intacta
 * e substituímos somente o bloco de preview durante a transformação do módulo.
 *
 * O editor também passa a usar getCmsEditorContent: conteúdo publicado + último
 * rascunho salvo, sem expor os rascunhos nas páginas públicas.
 */
function adminLivePreviewFix(): Plugin {
  return {
    name: "msk-admin-live-preview-fix",
    enforce: "pre",
    transform(code, id) {
      if (!id.replace(/\\/g, "/").includes("/src/components/msk/admin-editor.tsx")) return null;

      let next = code;

      const tutorialImport = 'import { TutorialsManager } from "@/components/msk/tutorials-manager";';
      const previewImport = 'import { AdminLivePreview } from "@/components/msk/admin-live-preview";';
      if (!next.includes(previewImport)) {
        next = next.replace(tutorialImport, `${tutorialImport}\n${previewImport}`);
      }

      next = next.replace(
        'import { getCmsContent, saveCmsDraft, publishCmsDraft, getCmsHistory, uploadCmsAsset } from "@/lib/cms.functions";',
        'import { getCmsContent, getCmsEditorContent, saveCmsDraft, publishCmsDraft, getCmsHistory, uploadCmsAsset } from "@/lib/cms.functions";',
      );
      next = next.replace(
        "const getCms = useServerFn(getCmsContent);",
        "const getCms = useServerFn(getCmsEditorContent);",
      );

      // Publicar deve sempre persistir primeiro o estado visual atual do editor.
      // Isso evita publicar um rascunho anterior logo após trocar uma imagem.
      next = next.replace(
        "      console.log('Publishing CMS content for key:', key, localSettings[key]);\n      await publishDraft({ data: { key } });",
        "      await saveDraft({ data: { key, data: localSettings[key] } });\n      await publishDraft({ data: { key } });",
      );

      const previewStart = '          <div className="mt-16 h-full p-8 overflow-y-auto no-scrollbar pb-24">';
      const previewEnd = '\n          </div>\n        </div>\n      </div>\n      </div>\n    </div>';
      const start = next.indexOf(previewStart);
      const end = start >= 0 ? next.indexOf(previewEnd, start) : -1;

      if (start >= 0 && end > start) {
        const replacement = [
          '          <div className="absolute inset-x-0 bottom-0 top-14 overflow-y-auto p-6 no-scrollbar">',
          '            <AdminLivePreview',
          '              activeSection={activeSection}',
          '              settings={localSettings}',
          '              initialSettings={initialSettings}',
          '            />',
          '          </div>',
        ].join("\n");
        next = next.slice(0, start) + replacement + next.slice(end + '\n          </div>'.length);
      }

      // Corrige a edição das mensagens de recuperação. O código anterior criava
      // recovery_messages.value em vez de atualizar welcome/recovery/urgency.
      next = next.replace(
        "updateSetting('recovery_messages', 'value' as any, { ...current, [msg.key]: e.target.value } as any);",
        "setLocalSettings((prev: any) => ({ ...prev, recovery_messages: { ...(prev?.recovery_messages || {}), [msg.key]: e.target.value } }));",
      );

      return next === code ? null : { code: next, map: null };
    },
  };
}

/**
 * Conecta a Central MSK Agente ao Super Admin e a expõe como menu principal.
 * O componente comercial antigo continua disponível dentro da Central, então
 * nenhuma função de ofertas/compras/upload é removida.
 */
function adminAgentCenter(): Plugin {
  return {
    name: "msk-admin-agent-center",
    enforce: "pre",
    transform(code, id) {
      if (!id.replace(/\\/g, "/").includes("/src/routes/_authenticated/admin.tsx")) return null;

      let next = code;
      const oldImport = 'import { AdminAgentTab } from "@/components/msk/admin-agent";';
      const newImport = 'import { AdminAgentControlCenter as AdminAgentTab } from "@/components/msk/admin-agent-control-center";';
      if (next.includes(oldImport)) next = next.replace(oldImport, newImport);

      // Remove o atalho antigo escondido dentro de Licenças e cria uma seção
      // principal visível chamada MSK Agente no grupo Operação.
      next = next.replace('          { value: "agent", label: "MSK Agente" },\n', "");
      const usersItem = '      { value: "users", label: "Usuários", Icon: Users },';
      const agentItem = '      { value: "agent", label: "MSK Agente", Icon: Activity },';
      if (!next.includes(agentItem) && next.includes(usersItem)) {
        next = next.replace(usersItem, `${agentItem}\n${usersItem}`);
      }

      return next === code ? null : { code: next, map: null };
    },
  };
}

export default defineConfig({
  vite: {
    plugins: [
      recurringTrialCooldownFix(),
      adminCmsUploadAuthFix(),
      plansImageFallbackFix(),
      adminLivePreviewFix(),
      adminAgentCenter(),
      mcpPlugin(),
    ],
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/encode.js"),
        "entities": path.resolve(__dirname, "node_modules/entities"),
      },
    },
  },

  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});