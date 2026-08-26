# Auditoria: MSK Agente, OpenAI e GitHub

Somente leitura. Nenhum arquivo do projeto foi alterado e nenhum valor de secret foi exibido.

## 1. Variáveis/secrets existentes (apenas nomes)

Secrets do projeto (painel de Secrets):
- `LICENSE_ENCRYPTION_KEY`
- `LOVABLE_API_KEY` (gerenciado pela plataforma)

Variáveis de servidor referenciadas pelo código:
- Supabase: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (e no backend gerenciado: `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`)
- Licenças/extensão: `LICENSE_ENCRYPTION_KEY`, `EXTENSION_ORIGIN`
- Pagamentos: `PAYMENT_PROVIDER`, `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_RETURN_URL`, `AMPLOPAY_PUBLIC_KEY`, `AMPLOPAY_SECRET_KEY`, `AMPLOPAY_WEBHOOK_SECRET`
- Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- Outros: `APP_URL`, `CRON_SECRET`

Nenhuma variável com nome relacionado a OpenAI (`OPENAI_API_KEY` etc.) existe no projeto ou é referenciada no código. Nenhuma variável de GitHub (`GITHUB_CLIENT_ID`/`GITHUB_TOKEN`/App ID) existe.

## 2. GitHub OAuth / App

- O código de login já prevê GitHub: `src/routes/auth.tsx` lista o botão GitHub e `src/integrations/supabase/client.ts` valida o provider antes do redirect.
- Consulta ao endpoint público de settings de autenticação retornou apenas `email`, `google` e `apple` ativos. **GitHub OAuth não está habilitado** hoje — clicar no botão GitHub cai na mensagem "GitHub OAuth não está configurado".
- Não existe GitHub App (nenhum secret, webhook ou rota de callback GitHub no projeto).

## 3. Chave OpenAI utilizável no backend

- Não há `OPENAI_API_KEY`. Nenhum código chama a API da OpenAI.
- Existe `LOVABLE_API_KEY` (gateway de IA da plataforma), que dá acesso a modelos de chat/imagem/áudio no servidor sem precisar de chave própria da OpenAI. Ou seja: **há capacidade de IA utilizável no backend hoje, mas não via chave OpenAI direta.**

## 4. Estado do "MSK Agente" (integrações de agente)

Já existe um servidor MCP configurado em `src/lib/mcp/`:
- `name: msk-sistem`, autenticação OAuth 2.1 via Supabase (`acceptedAudiences: authenticated`), portanto cada chamada roda como o usuário logado (RLS aplicada).
- Ferramentas atuais: `get-my-account`, `list-my-licenses`, `get-my-token-balance`, `list-plans` (todas de leitura, escopo do próprio usuário).
- Não existe assistente virtual dentro do app (nenhum componente de chat/assistente no `src/`).

## 5. Onde integrar o assistente virtual com menor risco

Recomendação (a executar apenas após aprovação):

1. **Backend isolado:** nova rota de streaming em `src/routes/api/chat.ts` usando o AI Gateway com `LOVABLE_API_KEY` lido dentro do handler. Nenhum arquivo existente de licenças, pagamentos ou push é tocado.
2. **Autorização:** exigir sessão Supabase no handler (mesmo padrão do `auth-middleware`), rejeitando anônimos. Todas as leituras de dados pelo assistente passam pelo token do usuário (RLS), nunca pela service role.
3. **Ponto de entrada na UI:** um botão flutuante/painel lateral montado apenas dentro de `src/routes/_authenticated/route.tsx` (layout já protegido), aparecendo em `painel`, `revendedor` e `admin` sem alterar o conteúdo dessas telas. Isso evita mexer nos fluxos de checkout, afiliados e licenças.
4. **Reuso seguro de dados:** o assistente consome as mesmas funções de leitura já usadas pelas tools MCP (conta, licenças, saldo de tokens, planos) em vez de novas queries, mantendo comportamento idêntico ao do painel.
5. **Sem escrita no primeiro estágio:** o assistente responde e orienta; ações que alteram estado (gerar licença, saque, aprovar afiliado) permanecem nos botões existentes.

## Observação

Nada acima requer chave OpenAI. Se você quiser especificamente modelos OpenAI, o caminho é adicionar `OPENAI_API_KEY` em Project Settings → Secrets; caso contrário o `LOVABLE_API_KEY` já cobre o assistente.
