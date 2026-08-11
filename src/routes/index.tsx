# CORREÇÃO DEFINITIVA — PLANOS E COMISSÕES

O sistema foi corrigido para utilizar uma única fonte de verdade: a tabela `plans` do banco de dados.

### 1. Fonte Única de Verdade
- Todas as consultas de planos (Site, Admin, Geração de Tokens) agora utilizam a tabela `plans`.
- Removidos filtros restritivos que impediam a visualização de planos no Gerador de Tokens.

### 2. Fluxo de Licenças e Tokens
- O `plan_id` é preservado em todo o ciclo de vida: `Transação -> Licença -> Token`.
- A duração da licença é extraída dinamicamente do plano selecionado.
- Adicionado snapshot dos dados do plano (nome, preço, duração) na licença para fins históricos.

### 3. Comissões Dinâmicas de Afiliados
- A comissão agora é calculada com base na configuração do plano (`affiliate_commission_rate` e `affiliate_commission_fixed`).
- Implementado sistema de snapshot na comissão: a porcentagem e o valor são registrados no momento da aprovação, protegendo o histórico contra alterações futuras no plano.
- Atualizado o Admin Editor para permitir configurar comissões específicas por plano.

### 4. Diagnóstico de Sistema
- Verificado RLS: Super Admins possuem acesso total aos planos, enquanto usuários anônimos veem apenas planos marcados como ativos.
- Corrigido o seletor de planos no Gerador Manual para exibir detalhes como preço e duração, facilitando a identificação.

O sistema agora está totalmente integrado e pronto para produção, seguindo as melhores práticas de arquitetura e segurança.
