# Compra personalizada de créditos MSK

## Objetivo
Substituir os planos fixos da página `/planos` por um fluxo único de compra de 10 a 1.000 créditos, com preço progressivo, Pix pelo gateway já ativo, teste grátis seguro e acompanhamento até a entrega manual da key.

## O que será construído
1. **Preço centralizado**
   - Uma única regra no servidor para as faixas de R$ 0,45 até R$ 0,20 por crédito.
   - Quantidade mínima 10, máxima 1.000 e passos de 5 créditos.
   - O navegador apenas exibe o cálculo; o servidor recalcula e valida o valor antes de criar a cobrança.

2. **Teste grátis — 4 créditos**
   - Consultar perfil e uso anterior no servidor.
   - Liberar 4 créditos uma vez a cada 24 horas por usuário/e-mail.
   - Registrar nome, e-mail, horário, quantidade e status no banco.
   - Impedir duplicidade por recarregamento, outra rota, dispositivo ou requisições simultâneas.
   - Ocultar a opção enquanto o prazo de 24 horas estiver ativo.

3. **Compra e Pix**
   - Seletor com botões, barra e campo numérico.
   - Resumo automático com nome, e-mail, quantidade, valor por crédito e total.
   - Exigir nome completo no cadastro antes de continuar.
   - Criar o pedido no banco e gerar Pix pelo gateway principal já configurado.
   - Não criar key nem adicionar créditos automaticamente.

4. **Status e suporte**
   - Estados: aguardando pagamento, pago/aguardando key, key entregue e cancelado.
   - Após a confirmação, destacar o pedido e abrir o suporte configurado com mensagem já preenchida.
   - Manter a compra aguardando key até uma ação administrativa.

5. **Minhas compras**
   - Mostrar no painel do cliente pedido, créditos, valor, data e status.
   - Exibir “Falar com o suporte” apenas quando o pagamento estiver confirmado e a key ainda não tiver sido entregue.

6. **Administração**
   - Lista de compras pagas aguardando key.
   - Ação protegida para marcar a key como entregue.
   - Registrar a mudança para auditoria.

7. **Página de planos**
   - Remover os carrosséis/cards tradicionais somente dessa página.
   - Preservar login, pagamentos existentes e demais páginas.
   - Manter o visual preto/neon MSK, sem cartões excessivos, adaptado a celular e computador.

## Detalhes técnicos
- Reutilizar `transactions` para pedidos e estados de entrega, com metadados de quantidade, preço e cliente.
- Reutilizar `token_allowances` para os 4 créditos do teste; criar uma função transacional no banco para garantir o intervalo de 24 horas sem disputa.
- Reutilizar a confirmação de pagamento e o modal Pix atuais, adaptando a finalização de compras de crédito para `aguardando_key`.
- Todas as leituras e ações serão autenticadas e validadas no servidor; a interface não será fonte de verdade.
- Atualizar os títulos e descrições da página para refletir compra de créditos.

## Validação
- Testar limites, passos e todas as faixas de preço.
- Testar tentativa duplicada do teste grátis e corrida de duas solicitações.
- Testar criação do Pix, confirmação, histórico, mensagem do suporte e entrega administrativa.
- Conferir `/planos` e painel em celular e computador, sem telas vazias ou sobreposição.
