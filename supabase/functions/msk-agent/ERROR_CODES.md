# MSK Agente — Códigos de erro

O agente não deve retornar `MSK_AGENT_ERROR`. Falhas conhecidas recebem código específico. Falhas realmente desconhecidas usam `INTERNAL_ERROR` e geram um `error_id` em `msk_agent_errors` para diagnóstico administrativo.

| Código | Etapa típica | Retry | Significado / ação |
|---|---|---:|---|
| `AGENT_TARGET_NOT_FOUND` | locating_files | sim | O alvo não foi localizado com confiança. Repetir busca controlada ou pedir um esclarecimento objetivo. |
| `AGENT_NO_EDITABLE_FILES` | locating_files | não | O repositório não possui arquivos compatíveis com o executor atual. |
| `NO_CHANGES_APPLIED` | editing/validating | sim | A saída não produziu alteração real. Reprocessar mantendo o mesmo pedido e alvo. |
| `AI_RESPONSE_PARSE_ERROR` | analyzing/editing | sim | A resposta da IA não pôde ser interpretada com segurança. |
| `AI_EMPTY_RESPONSE` | analyzing | sim | A IA respondeu sem conteúdo utilizável. |
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
| `TASK_PERSISTENCE_FAILED` | request | não | A tarefa não pôde ser persistida antes da execução. |
| `PROJECT_REPOSITORY_MISMATCH` | repository | não | Tentativa de operar em repositório diferente do vinculado ao projeto. |
| `INTERNAL_ERROR` | unknown | não | Exceção ainda não classificada. Consultar `error_id` em `msk_agent_errors` e criar mapeamento específico se recorrente. |

## Dados registrados

`msk_agent_errors` guarda `task_id`, usuário/projeto, repositório, branch, etapa, código, mensagem, stack no servidor, flag retryable, tentativa e contexto sanitizado. Tokens, chaves, senhas, assinaturas e sessões são removidos do contexto antes de persistir.

## Regra de segurança

O frontend recebe somente mensagem segura, código, etapa, retryable e `error_id`. Stack trace e contexto técnico permanecem no backend administrativo. As tabelas de erro e lock têm RLS e não são concedidas a `anon`/`authenticated`; o acesso operacional usa apenas `service_role` no servidor.
