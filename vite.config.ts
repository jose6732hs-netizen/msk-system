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
 * Conecta a nova Central MSK Agente ao item já existente do Super Admin sem
 * reescrever a rota administrativa inteira. O componente comercial antigo é
 * importado pela própria Central e permanece disponível como aba interna.
 */
function adminAgentCenter(): Plugin {
  return {
    name: "msk-admin-agent-center",
    enforce: "pre",
    transform(code, id) {
      if (!id.replace(/\\/g, "/").includes("/src/routes/_authenticated/admin.tsx")) return null;
      const oldImport = 'import { AdminAgentTab } from "@/components/msk/admin-agent";';
      const newImport = 'import { AdminAgentCenter as AdminAgentTab } from "@/components/msk/admin-agent-center";';
      if (!code.includes(oldImport)) return null;
      return { code: code.replace(oldImport, newImport), map: null };
    },
  };
}

export default defineConfig({
  vite: {
    plugins: [adminLivePreviewFix(), adminAgentCenter(), mcpPlugin()],
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
