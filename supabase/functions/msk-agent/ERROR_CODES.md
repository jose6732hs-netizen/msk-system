# MSK Agente — Códigos de erro

O agente não deve retornar `MSK_AGENT_ERROR`. Falhas conhecidas recebem código específico. Falhas realmente desconhecidas usam `INTERNAL_ERROR` e geram um `error_id` em `msk_agent_errors` para diagnóstico administrativo.

| Código | Etapa típica | Retry | Significado / ação |
|---|---|---:|---|
| `TASK_PAYLOAD_INVALID` | request | não | O gateway rejeitou o payload antes da persistência. Corrigir campos obrigatórios/tipos. |
| `RLS_VIOLATION` | request | não | PostgreSQL `42501`/RLS recusou a operação. Revisar autorização/política. |
| `NOT_NULL_VIOLATION` | request | não | PostgreSQL `23502`: faltou campo obrigatório no registro. |
| `TABLE_NOT_FOUND` | request | não | PostgreSQL `42P01`: migration/tabela necessária ausente. |
| `DATABASE_SCHEMA_MISMATCH` | request | não | `42703`/`PGRST204`: runtime e schema estão desalinhados. |
| `FOREIGN_KEY_VIOLATION` | request | não | PostgreSQL `23503`: projeto/registro relacionado inválido ou removido. |
| `UNIQUE_VIOLATION` | request | sim | PostgreSQL `23505`: conflito de identificador/idempotência. |
| `DATABASE_VALUE_INVALID` | request | não | PostgreSQL `22P02`: formato de valor incompatível com o schema. |
| `DATABASE_TEMPORARILY_UNAVAILABLE` | request | sim | Deadlock/serialização/limite/indisponibilidade temporária (`40001`, `40P01`, `53300`, `57P0x`). |
| `DATABASE_NETWORK_UNAVAILABLE` | request | sim | Timeout ou falha de rede com o banco. |
| `POSTGREST_ERROR` | request | não | Erro PostgREST não coberto por mapeamento mais específico. |
| `DATABASE_PERSISTENCE_ERROR` | request | não | Erro de banco ainda não classificado; SQLSTATE/contexto ficam no backend. |
| `DATABASE_WRITE_CHECK_FAILED` | preflight | sim | O probe real de INSERT não pôde confirmar capacidade de gravação. |
| `DATABASE_WRITE_READY` | preflight | — | Probe transacional passou; nenhuma linha de teste é mantida. |
| `AGENT_TARGET_NOT_FOUND` | locating_files | sim | O alvo não foi localizado com confiança. Repetir busca controlada ou pedir um esclarecimento objetivo. |
| `AGENT_NO_EDITABLE_FILES` | locating_files | não | O repositório não possui arquivos compatíveis com o executor atual. |
| `NO_CHANGES_APPLIED` | editing/validating | sim | A saída não produziu alteração real. Reprocessar mantendo o mesmo pedido e alvo. |
| `AI_RESPONSE_PARSE_ERROR` | analyzing/editing | sim | A resposta da IA não pôde ser interpretada com segurança. |
| `AI_EMPTY_RESPONSE` | analyzing | sim | A IA respondeu sem conteúdo utilizável. |
| `AI_RESPONSE_TRUNCATED` | analyzing | sim | A IA cortou a resposta no limite de tokens (modelos de raciocínio gastam tokens pensando). |
| `AI_NO_OPERATIONS` | editing | sim | A IA respondeu, mas sem nenhuma operação de arquivo; o texto devolvido pela IA acompanha o erro. |

| `AI_REQUEST_TIMEOUT` | analyzing | sim | Timeout do provedor de IA. |
| `AI_NETWORK_UNAVAILABLE` | analyzing | sim | Falha temporária de rede com a IA. |
| `AI_RATE_LIMIT` | analyzing | sim | Rate limit do provedor de IA. |
| `AI_UPSTREAM_UNAVAILABLE` | analyzing | sim | Falha 5xx/temporária do provedor. |
| `AI_CONFIGURATION_ERROR` | auth | não | Configuração/chave interna da IA indisponível. |
| `VALIDATION_FAILED` | validating | sim | A alteração não correspondeu semanticamente ao pedido ou apresentou risco fora do escopo. |
| `PRECOMMIT_VALIDATION_FAILED` | validating | sim | Pré-condições de commit falharam. |
| `EDITOR_OPERATION_FAILED` | editing | sim | Uma operação de edição não pôde ser aplicada ao conteúdo atual. |
| `LOCK_ACQUISITION_FAILED` | locking | sim | Outra tarefa já edita o mesmo repositório+branch. |
| `GITHUB_API_TIMEOUT` | repository/committing/verifying | sim | Timeout do GitHub. |
| `GITHUB_NETWORK_UNAVAILABLE` | repository | sim | Falha temporária de rede com GitHub. |
| `GITHUB_RATE_LIMIT` | repository | sim | Rate limit do GitHub. |
| `GITHUB_API_UNAVAILABLE` | repository | sim | GitHub 5xx temporário. |
| `GITHUB_CONFLICT` | committing | sim | O branch mudou/conflitou. O agente pode preparar branch/PR isolado. |
| `GITHUB_AUTH_FAILED` | auth/repository | não | Autorização do GitHub recusada. |
| `GITHUB_PERMISSION_DENIED` | repository | não | Instalação sem permissão necessária. |
| `GITHUB_RESOURCE_NOT_FOUND` | repository | não | Recurso esperado não existe ou não está autorizado. |
| `GITHUB_APP_CREDENTIALS_INVALID` | auth | não | Credencial interna do GitHub App inválida. |
| `GITHUB_BIND_FAILED` | auth | não | Falha ao persistir vínculo projeto/instalação. |
| `COMMIT_VERIFICATION_FAILED` | verifying | sim | O SHA final do branch não corresponde ao commit que o agente criou. Nunca marcar como concluído. |
| `TASK_PROCESSING_TIMEOUT` | qualquer etapa ativa | sim | A tarefa excedeu o limite seguro e foi encerrada sem falso sucesso. |
| `TASK_PERSISTENCE_FAILED` | request | não | Código legado de encapsulamento. O runtime deve remapear o erro original para um código de banco específico antes de responder. |
| `PROJECT_REPOSITORY_MISMATCH` | repository | não | Tentativa de operar em repositório diferente do vinculado ao projeto. |
| `INTERNAL_ERROR` | unknown | não | Exceção ainda não classificada. Consultar `error_id` em `msk_agent_errors` e criar mapeamento específico se recorrente. |

## Persistência e RLS

O executor usa `SUPABASE_SERVICE_ROLE_KEY`, portanto o backend pode contornar RLS. A autorização é feita manualmente antes da gravação: identidade/licença, propriedade do `lovable_project_id`, instalação GitHub, repositório e sessão MSK. O pre-flight chama `msk_task_persistence_probe`, que tenta um `INSERT` real em `msk_tasks` dentro de um bloco transacional e força rollback; isso valida constraints/triggers/schema sem deixar tarefa de teste no banco.

## Dados registrados

`msk_agent_errors` guarda `task_id`, usuário/projeto, repositório, branch, etapa, código, mensagem, stack no servidor, flag retryable, tentativa e contexto sanitizado. O gateway também registra o payload de execução de forma estruturada imediatamente antes do pre-flight/persistência. Tokens, chaves, senhas, assinaturas, sessões e ciphertexts são removidos do contexto antes de persistir/logar.

## Regra de segurança

O frontend recebe somente mensagem segura, código, etapa, retryable e `error_id`. Stack trace e contexto técnico permanecem no backend administrativo. As tabelas de erro e lock têm RLS e não são concedidas a `anon`/`authenticated`; o acesso operacional usa apenas `service_role` no servidor.
