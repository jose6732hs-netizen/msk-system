# MSK Agente v3.4.74

Build com quatro bolinhas fixas na interface: Chat, GitHub, Supabase e Lovable Cloud.

## Alterações
- Supabase e Lovable Cloud agora possuem bolinhas separadas com logos oficiais já incluídas no pacote.
- Captions usam `white-space: nowrap` para evitar nomes quebrados.
- Clique em Supabase abre card específico e tenta conexão automática primeiro.
- Se `MSK_SUPABASE_OAUTH_CLIENT_ID`, `MSK_SUPABASE_OAUTH_CLIENT_SECRET` e `MSK_SUPABASE_OAUTH_REDIRECT_URI` estiverem configurados, usa o OAuth oficial da Supabase Management API, processa callback e salva tokens criptografados.
- Sem OAuth configurado, o mesmo card oferece conexão manual segura por Project URL + chave.
- Clique em Lovable Cloud identifica o `lovable_project_id` atual e cria vínculo automaticamente; endpoint/API key continuam opcionais para teste adicional.
- Credenciais ficam cifradas via AES-256-GCM no backend.
- Mantém tarefas longas, prova independente de commit e botão Atualizar Preview das versões anteriores.

## Build
- Version: 3.4.74
- Protected files: 94
- Integrity root: `0790531a183150af50d807e5f38b98af00c6c1d5b6a2ba73ef187461ba7a1feb`
- ZIP SHA-256: `fe7ede8039997be544f6e5df3e5a51825ae620bf96f14278d089a4690394af1e`
- Backend: `msk-database-connections` v3 ACTIVE.
