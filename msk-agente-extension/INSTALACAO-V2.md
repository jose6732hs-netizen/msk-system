# MSK Agente 2.0 — instalação do administrador

Os clientes finais só instalam a extensão, criam a conta MSK e confirmam o GitHub no popup oficial uma vez.

## 1. Banco central

Execute `supabase/MSK-V2-MULTIUSUARIO.sql` uma única vez no SQL Editor do projeto Supabase central.

## 2. Edge Function

Crie/publice a função `msk-api` usando `supabase/functions/msk-api/index.ts` e mantenha a verificação JWT da plataforma desativada. A própria função valida o JWT do usuário.

Cadastre os secrets:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `MSK_TOKEN_ENCRYPTION_KEY` — exatamente 32 bytes ou Base64URL de 32 bytes
- `MSK_STATE_SECRET` — segredo longo e aleatório
- `OPENAI_API_KEY` — chave usada somente no backend para executar as edições

O Supabase já fornece `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` à função.

## 3. GitHub OAuth

No GitHub App/OAuth App usado pelo MSK, configure a callback URL:

`https://SEU-PROJETO.supabase.co/functions/v1/msk-api?action=github-callback`

## 4. Licenças

Cada cadastro recebe um plano `free`. O administrador controla duração e liberação somente no servidor. Exemplo:

```sql
update public.plans
set tier = 'pro',
    billing_period = 'monthly',
    status = 'active',
    starts_at = now(),
    ends_at = now() + interval '1 month',
    valid_until = now() + interval '1 month',
    badge_removal_enabled = true,
    updated_at = now()
where user_id = 'UUID_DO_CLIENTE';
```

Use `1 day`, `7 days`, `1 month` ou `3 months` para os períodos diário, semanal, mensal e trimestral.

## 5. Instalação do cliente

Em `chrome://extensions`, ative o modo do desenvolvedor, clique em **Carregar sem compactação** e escolha a pasta descompactada. O cliente abre um projeto Lovable, entra na conta MSK e clica em **Conectar este projeto**.

O painel não consegue consultar se a conta pessoal do cliente é ChatGPT Free, Plus ou Pro. Ele mostra corretamente o plano e a validade do produto MSK. O modelo é chamado no backend por API, com limites por cliente.
