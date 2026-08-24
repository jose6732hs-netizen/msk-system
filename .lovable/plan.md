# Plano de Implementação: Melhorias no Cadastro, Recuperação de Leads e Correção de Licenças

Este plano detalha a implementação do campo de telefone no cadastro, ferramentas de recuperação de leads via WhatsApp e correções na lógica de ativação/contagem de expiração de licenças.

## Alterações de Interface (UI)

- **Cadastro (Auth):**
  - Adicionar campo "WhatsApp (DDD + Número)" na tela de criação de conta (`src/routes/auth.tsx`).
  - O campo será obrigatório para facilitar a recuperação de leads e suporte.

- **Painel Administrativo (Super Admin):**
  - **Aba de Usuários:** Adicionar coluna "WhatsApp" com botão direto para abrir conversa.
  - **Aba de Suporte/CMS:** Adicionar seção para configurar "Mensagens Prontas" (Boas-vindas, Recuperação, Urgência).
  - Integrar essas mensagens no link de WhatsApp da lista de usuários.

- **Componente de Licenças (Painel do Usuário):**
  - Corrigir o display do contador regressivo para mostrar o tempo real apenas após a ativação.
  - Ajustar rótulos mal escritos (ex: "Licença de 30 dias" aparecendo para licenças diárias).

## Alterações Técnicas

### 1. Banco de Dados e API
- **Profiles:** Garantir que o campo `phone` seja capturado durante o `signUp`.
- **CMS/Settings:** Criar chaves no `app_settings` para as mensagens prontas de WhatsApp.

### 2. Lógica de Licenciamento (`src/lib/license-validate.server.ts` & `src/lib/commerce.server.ts`)
- **Ativação Diferida:** 
  - Validar que a licença `paid` (comprada) nasce com `expires_at = null` e `metadata.pending_duration_ms` preenchido.
  - No primeiro `/activate` ou `/validate`, calcular `expires_at = now + pending_duration_ms`.
  - Garantir que o contador na extensão/painel reflita esse estado "Aguardando Ativação" antes do uso.

### 3. Notificações e Emails
- Corrigir o texto de venda aprovada em `src/lib/notification-service.server.ts` e `src/lib/checkout.server.ts` para usar a duração correta do plano dinamicamente, em vez de textos estáticos.

### 4. Recuperação de Leads
- Implementar utilitário `src/lib/support-link.ts` para gerar links de WhatsApp dinâmicos injetando as variáveis do lead (nome, plano escolhido).

## Verificação
- Testar fluxo de cadastro com telefone.
- Gerar licença diária e verificar se o texto de notificação diz "Licença Diária" e não "30 dias".
- Ativar licença na extensão e confirmar que o `expires_at` é definido apenas nesse momento.
- Verificar botão de WhatsApp no admin enviando a mensagem configurada.
