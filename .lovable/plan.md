# MSK Agente v3.15.01 — execução rápida e sem loops

## Objetivo

Corrigir a extensão enviada e o motor central sem remover recursos existentes. Pedidos simples devem virar uma alteração e um commit rapidamente; pedidos grandes devem ser divididos em entregas funcionais, sem ficar presos em planejamento ou troca infinita de IA.

## Alterações

1. **Rota rápida para mudanças simples**
   - Reconhecer texto, cor, imagem, link, tamanho, espaçamento e visibilidade mesmo com erros de digitação.
   - Localizar o alvo de forma determinística e evitar IA quando a alteração puder ser comprovada diretamente.
   - Fazer uma única alteração cirúrgica, validar o arquivo e criar um commit real.
   - Se o alvo não puder ser provado, cair uma única vez para o executor normal, sem reiniciar a tarefa.

2. **Execução de pedidos grandes por etapas**
   - Classificar criação de site, página, painel ou fluxo como trabalho em etapas.
   - Produzir um plano curto uma única vez e reutilizá-lo durante toda a tarefa.
   - Construir primeiro uma parte navegável e útil; depois continuar pelas dependências e funcionalidades.
   - Preservar arquivos já concluídos e registrar o progresso real de cada etapa.

3. **Limites contra repetição**
   - Remover tentativas aninhadas que multiplicam chamadas ao mesmo modelo/provedor.
   - Permitir no máximo uma correção da mesma saída e uma passagem ordenada pelas rotas alternativas elegíveis.
   - Nunca repetir a edição depois que o commit já foi confirmado.
   - Encerrar com erro claro quando o orçamento de tentativas terminar, preservando o último estado válido.

4. **IA e validação proporcionais**
   - Pular planejamento e revisão semântica por IA em microedições determinísticas.
   - Em alterações normais, usar uma geração e no máximo uma autocorreção.
   - Em tarefas grandes, validar e commitar cada etapa funcional antes de avançar.
   - Manter segurança, proteção de segredos, autenticação, pagamentos, banco, escopo do repositório e verificação do SHA.

5. **Estados reais na interface**
   - Mostrar: localizando, editando, validando, criando commit, sincronizando e concluído/ação necessária.
   - Exibir a IA efetivamente usada e a troca de rota somente quando ocorrer uma falha real.
   - Limpar tarefas antigas ou restauradas que ficaram marcadas como “executando” sem atividade.
   - Após commit confirmado, finalizar o primeiro plano e deixar a sincronização da prévia em segundo plano, sem spinner infinito.

6. **Entrega e validação**
   - Atualizar a versão da extensão para `3.15.01` e o relatório de build.
   - Recalcular o manifesto de integridade, se o pacote usar essa proteção.
   - Validar manifesto e todos os JavaScripts, testar classificações simples/complexas e simular os limites de tentativa.
   - Gerar um novo ZIP instalável preservando o arquivo enviado original.
   - Atualizar e publicar o motor central necessário para que a extensão e o servidor usem o mesmo contrato.

## Resultado esperado

- “Mude a cor deste texto para laranja” segue o caminho rápido e gera um único commit.
- “Crie um site completo…” recebe planejamento único, execução progressiva e commits funcionais por etapa.
- Nenhuma tarefa fica em criação contínua, repete o mesmo pedido após commit ou alterna modelos sem limite.
- A extensão informa o estado real e conclui assim que houver commit confirmado, mantendo a prévia como verificação separada.
