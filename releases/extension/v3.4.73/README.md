# MSK Agente v3.4.73 — Banco + tarefas longas + preview

Build combinada sobre a v3.4.72. Mantém checkpoints e prova independente de finalização e acrescenta:

- reconciliação segura de tarefas longas pela mesma `task_id`;
- watchdog de 12 minutos sem heartbeat no `msk-agent-proof`, evitando o antigo falso timeout de 150s;
- janelas de transporte maiores sem retry cego do comando de edição;
- chat direto sempre ancorado imediatamente acima do composer;
- botão `Atualizar Preview` no resumo final;
- gerenciador de conexões de banco por projeto para Supabase e Lovable Cloud;
- credenciais criptografadas AES-256-GCM e nunca retornadas ao frontend;
- prova independente obrigatória antes do sucesso visual.

## Backend

- `msk-agent-proof` v3 ACTIVE.
- `msk-database-connections` v1 ACTIVE.
- `msk-agent-public` v12 permanece ACTIVE para documentação complexa.

## Segurança do banco

A tabela `msk_database_connections` usa RLS + FORCE RLS. `anon` e `authenticated` não possuem SELECT direto; `service_role` possui o acesso interno necessário. O Lovable Cloud só aparece como `connected` quando um endpoint explícito responde; vínculo apenas por Project ID aparece como `linked`.

## Validação da build

- Manifest: `3.4.73`
- Arquivos protegidos: `94`
- JavaScript verificados com `node --check`: `33`
- ZIP: `unzip -t` sem erros
- Integrity Root: `5546a5b80d85bf623b8b200ba92912e9b93714cd94757f1f9a3854527a30d9a4`
- ZIP SHA-256: `89c1e03e1b9f49b72910ee1bdbcad951582219ee0a3e3143cb74db6bd8dc2247`

Não foi realizado teste end-to-end em um Chrome real nesta sessão; a validação acima é estática + backend publicado.