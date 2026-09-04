# Correção da seleção de IA e painel de execução — extensão 3.4.9

## Objetivo
Estabilizar a versão 3.4.9 enviada, impedir que provedor/modelo fiquem presos em “Carregando…” e mostrar, acima do chat, o andamento real de cada solicitação.

## Implementação
1. **Basear a correção na extensão 3.4.9 enviada**
   - Incorporar somente os arquivos oficiais da versão enviada à pasta da extensão.
   - Preservar licença, integridade, GitHub OAuth/App, projetos, checkpoints e recuperação de execuções longas.

2. **Eliminar o loop dos seletores**
   - Inicializar o catálogo independentemente das verificações posteriores de projeto/GitHub.
   - Aplicar timeout por espelho e sempre encerrar o estado “Carregando…”.
   - Usar o último catálogo válido salvo no navegador quando a rede estiver indisponível.
   - Se não houver cache nem catálogo online, mostrar “Catálogo indisponível” com nova tentativa automática limitada, sem loop infinito.
   - Impedir múltiplos listeners e múltiplas rotinas concorrentes de carregamento.

3. **Garantir a rota selecionada**
   - Antes de enviar, aguardar a seleção terminar de carregar.
   - Enviar `routing_mode: explicit`, `provider` e `model` quando o cliente escolher uma IA; usar rota ativa somente quando não existir seleção válida.
   - Exibir a rota solicitada e a rota efetivamente retornada pelo backend.

4. **Painel profissional de execução acima do chat**
   - Mostrar estados: preparando, conectando, IA/modelo em execução, analisando arquivos, tentativa/revezamento, aplicando mudanças, atualizando prévia, concluído ou preservado.
   - Exibir provedor/modelo atual, número da tentativa, rota (explícita/automática), arquivos alterados e horário.
   - Manter o resultado final visível após a execução, em vez de esconder todo o status no `finally`.
   - Tornar o painel responsivo e compatível com temas claro/escuro.

5. **Integridade e entrega**
   - Atualizar versão e hashes de integridade somente depois de concluir todas as alterações.
   - Validar sintaxe dos scripts, catálogo/rota simulados e interface da extensão em navegador.
   - Gerar um ZIP instalável final sem metadados de Git.

## Limites
- Não alterar regras de licença, autenticação, pagamentos, Super Admin ou permissões de GitHub.
- Não inventar disponibilidade de IA: a interface mostrará somente informações confirmadas pelo catálogo/backend.
- O revezamento de provedores continuará sendo responsabilidade do backend; a extensão apenas mostrará as tentativas/rota reportadas e preservará o projeto em falhas.
