# Ativação do backend MSK

1. Crie ou escolha o projeto Supabase central do MSK.
2. Execute a migration em `supabase/migrations`.
3. Crie um GitHub App com:
   - Repository contents: Read and write
   - Pull requests: Read and write
   - Metadata: Read-only
   - Setup URL: `https://SEU_REF.supabase.co/functions/v1/msk-agent`
4. Publique a função:

   `supabase functions deploy msk-agent --no-verify-jwt`

5. Configure os Secrets no Supabase:

   - `OPENAI_API_KEY`
   - `GITHUB_APP_ID`
   - `GITHUB_APP_SLUG`
   - `GITHUB_APP_PRIVATE_KEY`
   - `MSK_STATE_SECRET` (valor longo e aleatório)

6. Preencha apenas uma vez `config.js` com a URL e a anon key do projeto Supabase central.
7. Recarregue a extensão.

## Atualização do backend 1.6

Depois de substituir o código da função `msk-agent`, publique-a novamente. Esta versão adiciona consulta de progresso por tarefa e aprovação do Pull Request pelo botão **Aplicar alteração e atualizar site**. Nenhuma nova tabela é necessária.

O usuário final não informa URL, chave da OpenAI nem token GitHub. Ao clicar na bolinha GPT, ele instala o GitHub App, retorna ao Lovable e recebe uma sessão específica para aquele projeto.

Por segurança, o agente nunca envia direto para a branch principal: cria uma branch `msk/*` e um Pull Request para revisão.
