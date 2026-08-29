## Novidades v2.4.64
- Cofre de Integrações MSK com campos mascarados e botão de visualização.
- Solicitação dinâmica de Base URL, Client ID, CPF/CNPJ, API Key, Webhook Secret e outros campos conforme a API.
- Segredos ficam apenas na sessão da extensão e não são enviados ao chat/logs.


## v2.4.62 — autorização GitHub guiada no ChatGPT

- Reconhece respostas em que o GitHub está instalado, mas as ferramentas/conector ainda não estão disponíveis na conversa.
- Mostra na extensão um card **Permissão para iniciar a automação** antes de abrir qualquer autorização.
- O botão tenta primeiro a área de Plugins/Conectores da conversa atual e procura o GitHub.
- Se a interface de Plugins da conversa não estiver disponível, usa como fallback a área oficial do Codex/GitHub.
- Não usa o agente do Lovable nem consome créditos do Lovable para essa autorização.
- Após a autorização, preserva o projeto/repositório e tenta retomar o último comando pendente.

## MSK Agente v2.4.52 — Card “Enviado por MSK” com brilho suave

- Mensagens enviadas pela extensão no **ChatGPT** são substituídas visualmente por um card compacto **“Enviado por MSK”** com a logo MSK.
- A borda possui brilho animado muito suave em **verde, rosa e roxo**, girando continuamente sem piscar ou poluir a interface.
- O prompt técnico original permanece intacto para o ChatGPT; apenas a exibição visual é compactada.
- Ao clicar no card, o usuário pode expandir e ver o pedido original enviado pela extensão.
- A extensão reaplica o card após rerenderizações da interface do ChatGPT e guarda um histórico curto para restaurá-lo após recarregamentos.
- Usuários com `prefers-reduced-motion` recebem a mesma borda em versão estática.

## MSK Agente v2.4.51 — Prompt protegido em cada envio

- Cada mensagem enviada para **ChatGPT, Grok ou BLACKBOX AI** recebe automaticamente o `project_id` e o repositório GitHub ativo.
- O texto que o cliente vê no painel continua sendo apenas o pedido original; o contexto técnico e as regras de proteção são adicionados somente no envio à IA.
- A IA recebe em cada comando a regra **“altere somente o que foi solicitado”**, preservando design, funções, dados, rotas, dependências, integrações e configurações fora do escopo.
- Mudanças desnecessárias como refatoração, renomeação, formatação ampla ou “melhorias extras” ficam proibidas sem pedido explícito.
- Se o pedido for apenas pergunta/análise, não há edição. Se pedir mudança, ela deve ser escrita no GitHub exato da mensagem e depois validada no preview do Lovable.
- Se o contexto antigo apontar para outro projeto, o `project_id + repositório` da mensagem atual prevalecem; a IA não pode editar outro destino.
- Em ambiguidade com risco de alteração indevida, a IA deve fazer uma única pergunta objetiva em vez de adivinhar.

## MSK Agente v2.4.50 — ChatGPT + Grok + BLACKBOX AI

- Licença validada na rota exclusiva do MSK Agente por e-mail + token.
- Sem bloqueio por IP, navegador, fingerprint ou instalação.
- Projeto e repositório GitHub são vinculados por `project_id`; cada IA mantém sua própria conversa.
- Depois de identificar o GitHub, o usuário escolhe **ChatGPT, Grok ou BLACKBOX AI**.
- O provedor escolhido recebe automaticamente `project_id + repositório` no prompt inicial e os próximos comandos da extensão.
- ChatGPT preserva a ponte existente; Grok e BLACKBOX AI usam pontes locais independentes com autorrecuperação, anexos e espelhamento das respostas.
- Guardião atua somente sobre o chat nativo do Lovable.
- Escrita no GitHub só pode ser declarada quando a conta/provedor realmente disponibilizar uma ferramenta autorizada de escrita.
- Diagnósticos discretos ficam disponíveis quando uma integração externa não está pronta.


## v2.4.19 — envio instantâneo e GitHub/Codex

- O comando do cliente é despachado para a conversa vinculada do ChatGPT imediatamente, sem esperar nova leitura do repositório/banco.
- Respostas que comprovam ausência de acesso de escrita ao GitHub geram um botão **Conectar GitHub para edição** dentro do chat da extensão.
- O botão abre o Codex, tenta iniciar automaticamente a conexão GitHub e acompanha o retorno do OAuth.
- Após a autorização retornar ao ChatGPT, o MSK volta ao Lovable e tenta retomar o último comando pendente na conversa original.
- A integração GitHub comum do ChatGPT pode ser somente leitura; edição/push exige uma ferramenta de escrita como Codex.
## MSK Agente v2.4.18

- **Guardião anti-créditos:** nenhum prompt da extensão é enviado ao agente/chat do Lovable.
- Guardião ON bloqueia visualmente o compositor nativo do Lovable; Guardião OFF libera a digitação, mas o envio continua sendo interceptado e redirecionado ao MSK/ChatGPT.
- O comando inicial exige edição **direta no GitHub** usando ferramentas de escrita realmente disponíveis; o Lovable fica restrito a preview/sincronização/publicação.
- Falta de créditos no workspace Lovable não encerra uma edição GitHub. A extensão tenta continuar e separa edição de preview/publicação.
- Diagnóstico factual: distingue limite do ChatGPT, créditos Lovable, repositório ausente, GitHub sem escrita, ferramenta indisponível, autenticação e falhas de build.
- Os diagnósticos registram **origem, problema, evidência observada e próxima ação**, ficam salvos por `project_id` e aparecem no painel MSK.
- Quando a conversa do ChatGPT está aberta, o mesmo diagnóstico também aparece em um card pequeno dentro da página do ChatGPT.
- “Atualizar preview/site” não aprova mais tarefa por servidor; ele apenas tenta sincronizar/publicar o estado que já deve estar no GitHub.
- O backend MSK continua apenas para licença/token e funções auxiliares; chat/edição não passam pelo agente do Lovable.

## MSK Agente v2.4.17

- Anexos múltiplos enviados ao ChatGPT (sem filtro artificial de tipo; limites reais são definidos pelo ChatGPT/navegador).
- Gravação/transcrição com onda sonora ao vivo no painel.
- ZIP, imagens, áudio, vídeo, documentos e código podem ser selecionados pelo clipe; recusas do ChatGPT são mostradas no chat.


## v2.4.13 — modo rápido + continuidade de conversa
- O comando inicial agora força execução direta quando o pedido estiver claro, preservação total do que não foi solicitado e validação antes de qualquer confirmação de sucesso.
- Respostas operacionais devem ser curtas; código/JSON/logs só aparecem quando o usuário pedir.
- A extensão detecta limite de comprimento da conversa e mostra `Criar nova conversa e continuar`.
- A nova conversa recebe automaticamente `project_id`, repositório e um pacote compacto do histórico recente para continuar de onde parou.
- Limites de uso do plano/conta não são burlados: nesses casos a extensão informa o limite real e não promete que uma nova conversa o remove.

# MSK Agente v2.4.11

## v2.4.11 — ChatGPT como ponte + publicação confirmada

- O servidor MSK fica fora do caminho das mensagens do chat; ele continua apenas para licença/token de acesso.
- `project_id + repositório` ficam salvos localmente por projeto e não somem ao sair da tela GitHub.
- “Conectar com ChatGPT” abre uma conversa nova no ChatGPT, envia automaticamente o contexto do projeto e espelha as respostas no chat da extensão.
- O botão “Já conectei” continua como fallback e não reinicia OAuth.
- “Publicar / atualizar” mostra apenas estados curtos no chat: `Atualizando projeto…` → `Confirmando atualização…` → `✅ Projeto atualizado`.
- A URL pública antiga não confirma uma nova publicação. A extensão espera evidência de um novo ciclo de publicação e só conclui quando o processamento termina.
- Se não houver confirmação real do Lovable, o status final é erro/não confirmado. Nenhum código bruto, JSON ou log técnico é despejado pelo fluxo de publicação.

## Correção — GitHub persistente por projeto
- O repositório detectado em `settings/git/github` é salvo em `chrome.storage.local` por `project_id`.
- Ao sair da tela Git do Lovable, o status continua mostrando o mesmo repositório.
- A ausência de um link GitHub no DOM de outra página não apaga o vínculo salvo.
- O botão “Já conectei” continua como fallback e não força novo OAuth.
- “Conectar com ChatGPT” reutiliza o repositório persistido.


## v2.4.9 — chat independente da sessão de edição

- Corrige o erro **“Sessão MSK não autorizada”** ao enviar mensagens comuns como “OI”.
- O chat agora possui uma rota própria e continua respondendo mesmo sem token de escrita do GitHub.
- Se uma tentativa de edição retornar 401/sessão inválida, a extensão cai automaticamente para o chat e mostra a resposta no histórico em vez do erro bruto.
- A detecção automática do repositório pelo ID abre em segundo plano exatamente `/projects/{id}/settings/git/github`, que é a tela onde o Lovable expõe o repositório vinculado.
- O botão **Já conectei** continua como fallback e não reinicia OAuth.

> Segurança: confirmar manualmente o GitHub libera o fluxo e a UI, mas alterações que gravam no repositório ainda exigem uma credencial de escrita válida no backend.
# MSK Agente — Guardião Lovable v1.3.0

## Instalação
1. Extraia o arquivo ZIP.
2. Abra `chrome://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Escolha a pasta extraída.
6. Atualize a aba do Lovable.

## O que esta versão faz
- Detecta o ID do projeto pela URL e mantém o progresso mesmo ao trocar de página.
- Publica o projeto, aguarda a confirmação e abre o fluxo correto de GitHub.
- Pausa apenas nas autorizações oficiais de GitHub e Supabase.
- Continua automaticamente depois da confirmação e registra site, repositório e banco.
- Mostra o Guardião MSK e as bolinhas com logos do MSK, GitHub, Supabase e Lovable.
- Adiciona um aro luminoso giratório em volta do compositor do chat Lovable.
- Espelha no painel MSK os comandos enviados no chat nativo, sem bloquear o envio ao Lovable.
- Mostra os estados **Enviado**, **Executando** e **Concluído**.
- Permite digitar no painel MSK e encaminhar o texto ao chat do Lovable.
- Preserva e exibe somente os limites reais informados pela conta.
- Inclui uma bolinha GPT que conecta o GitHub App e ativa o agente Supabase.
- Quando o GPT está ativo, os comandos do chat são enviados ao agente MSK, não ao chat nativo.
- O agente lê o repositório identificado, cria uma branch e abre um Pull Request para aprovação.

## Backend

Consulte `SUPABASE-SETUP.md`. A extensão só executa alterações reais depois que a Edge Function, o GitHub App e os Secrets forem publicados.

## Prompt do Guardião

Você é o Guardião MSK integrado à interface do Lovable. Espelhe comandos e acompanhe cada etapa com estados claros. Preserve os limites reais da conta, nunca exponha chaves ou tokens privados e pause para confirmações oficiais de autorização.

## Observação
A extensão não exibe nem armazena tokens secretos. Para o banco, usa o ID/ref estável do projeto; IPs podem mudar.

## v2.4.5 — fallback de conexão e chat
- Botão **“✓ Já conectei”** aparece quando o GitHub já foi conectado, mas a detecção automática não confirma.
- A confirmação manual é salva por `lovable_project_id` e não repete OAuth desnecessariamente.
- O backend tenta recuperar o repositório ativo antes de considerar a conexão ausente.
- O banco de dados deixou de ser requisito para enviar mensagens no chat.
- Histórico do chat cliente ↔ MSK é persistido por projeto no `chrome.storage.local`.
- Se a execução falhar apenas por falta de vínculo GitHub/projeto, o chat usa a ação `msk-api?action=chat` e continua respondendo.

> Para o fallback de chat funcionar no backend multiusuário, publique a versão incluída de `supabase/functions/msk-api/index.ts`.


## v2.4.8 — Chat como central de ações
- Repositório identificado passa a ser exibido como GitHub conectado, evitando falso “não autorizado”.
- Confirmação manual fica vinculada ao project_id e evita nova autorização automática.
- Banco/Supabase deixa de ser requisito visível para ativar o agente.
- Ações como Publicar/Atualizar e Remover badge voltam automaticamente à aba Chat.
- Início, andamento, conclusão e erro dessas ações são registrados no histórico do chat por projeto.
- Publicação só aparece como “publicada” depois de confirmação observável do Lovable.

## v2.4.13 — ChatGPT em segundo plano e permissões no painel

- Depois da primeira confirmação do ChatGPT, o foco volta automaticamente para a aba do projeto Lovable.
- A aba do ChatGPT permanece como ponte em segundo plano para a conversa do projeto.
- As respostas em geração são atualizadas em um único balão no chat MSK e a resposta final é persistida no histórico.
- Solicitações interativas do ChatGPT (por exemplo, permitir, confirmar, conectar, continuar ou cancelar) são espelhadas no chat da extensão com botões clicáveis.
- A escolha feita na extensão é enviada para a conversa vinculada e a execução continua sem o usuário precisar voltar manualmente ao ChatGPT.
- Credenciais e telas externas de OAuth, quando realmente exigidas pelo provedor, continuam sendo feitas somente na página oficial do respectivo serviço.



## v2.4.15 — correção de publicação
- Corrigido reconhecimento dos controles Publicar/Atualizar/Republicar.
- Compatível com fluxos em que o primeiro clique já inicia a publicação e com fluxos que exibem um segundo botão de confirmação.
- A conclusão continua dependendo de sinais reais de processamento/fim do Lovable.


## v2.4.17 — permissões e fluxo GitHub
- Corrige falso modal de permissão causado por menus/barra lateral do ChatGPT.
- Cards de permissão desaparecem imediatamente após a decisão e também quando a solicitação deixa de existir.
- Conectar com ChatGPT exige primeiro GitHub identificado/confirmado; se faltar, abre o fluxo GitHub do Lovable e volta ao projeto.
- Remove o guia flutuante com botões extras; apenas destaca o botão oficial do GitHub quando um clique real é necessário.
- “Já conectei” conclui o fallback, salva o estado e volta automaticamente ao projeto.

### Publicação obrigatória antes de criar o GitHub
- Se o projeto ainda nunca foi publicado e não possui repositório, o MSK interrompe a criação do GitHub e mostra o card **“Publique o projeto antes do GitHub”**.
- O botão **“🚀 Publicar agora”** usa o fluxo oficial de publicação do Lovable, confirma o deploy e só então continua automaticamente para a conexão/criação do repositório.
- Se a publicação não for confirmada, o repositório não é criado e o usuário recebe o status real no chat da extensão.


### v2.4.50 — rotas e estado GitHub por IA
- O Histórico abre sempre a workspace canônica `https://lovable.dev/projects/{project_id}` do projeto clicado.
- A troca de projeto salva o `project_id` solicitado, valida o ID carregado e só então inicializa o contexto daquele projeto.
- ChatGPT, Grok e BLACKBOX AI agora distinguem: conversa aberta, ponte ativa, repositório identificado e GitHub realmente disponível para escrita.
- Grok/BLACKBOX podem retornar estados específicos como GitHub não conectado, autorização necessária, permissão de escrita ausente ou atualização solicitada, sem confundir isso com o repositório já identificado.
- Um repositório salvo no projeto não é mais tratado como prova de acesso de escrita da IA.


## Regra de entrega v2.4.50
Toda edição enviada a ChatGPT, Grok ou BLACKBOX AI deve ser aplicada no GitHub conectado e depois refletida/sincronizada no Lovable para conferência em preview. O agente do Lovable não é usado para implementar código.


## v2.4.54 — Central de diagnóstico pronta para o SaaS
- Eventos e erros entram em uma fila local não bloqueante e são enviados para `/api/extension/events` e `/api/extension/errors` quando disponíveis.
- Heartbeat a cada 5 minutos via `/api/extension/heartbeat`.
- Checagem de versão via `/api/extension/version`, com aviso de atualização no painel.
- `installation_id` aleatório e persistente por instalação; contexto inclui conta/licença/plano, versão, projeto, repo e IA sem enviar token.
- Sanitização remove tokens, cookies, Authorization, chaves, `.env`, prompt/conteúdo e anexos antes de qualquer telemetria remota.
- Erros técnicos ficam nos logs; o cliente recebe mensagens curtas em linguagem simples.
- Se o SaaS/telemetria estiver fora do ar, a extensão continua funcionando e reenvia uma fila limitada depois.


## Atualização remota verificável — v2.4.54

- O SaaS pode anunciar a versão atual, versão mínima, obrigatoriedade, changelog e URL oficial de download.
- Clicar em **Baixar atualização** apenas inicia o download; isso nunca remove o aviso.
- O card muda para **arquivo baixado / falta instalar** e continua visível na versão antiga.
- Depois de instalar/recarregar, a extensão compara a versão realmente executando (`chrome.runtime.getManifest().version`) e revalida licença + e-mail no SaaS.
- O aviso só desaparece quando a versão exigida está realmente rodando **e** a identidade da licença foi confirmada.
- Downloads são aceitos somente do domínio oficial `msksystem.online`.
- Eventos de download iniciado, concluído, interrompido e atualização confirmada entram na telemetria.
- Se o backend estiver fora do ar, o agente continua funcionando; a atualização não bloqueia edição, GitHub ou IA.

## v2.4.55 — ChatGPT + Grok e conexão guiada

- BLACKBOX AI removida temporariamente da interface, permissões e bridge. A extensão oferece somente ChatGPT e Grok.
- Ao conectar o ChatGPT, o MSK aguarda a aba ficar pronta e envia automaticamente o prompt inicial com `project_id`, repositório e regras de segurança antes de marcar o provedor como conectado.
- O Grok recebe o mesmo card visual **Enviado por MSK**, com borda glow suave e comando expansível.
- Limites detectados no ChatGPT e no Grok são espelhados no chat da extensão em linguagem simples.
- O fluxo de projeto exibe estados explícitos: **Conectando projeto → Procurando repositório → Repositório encontrado → Projeto conectado**.
- Após a conexão do projeto, o botão principal passa para **Publicar projeto** ou **Publicar atualização**, conforme o estado real do Lovable.


## v2.4.57 — Prompt seguro mais breve
- O reforço automático enviado em cada comando foi reduzido para um bloco curto e direto.
- Mantém project_id + repositório, foco estrito no pedido, preservação do restante, validação e GitHub → Lovable/preview.
- Remove repetições que podiam gastar contexto ou tirar o foco do pedido do cliente.
- O prompt inicial de conexão continua completo; a redução vale para os comandos seguintes.


## v2.4.58 — contador de publicação
O botão de atualização mostra um badge compacto com a quantidade de edições concluídas ainda não publicadas. A contagem é por projeto e zera somente após publicação confirmada.

## v2.4.59 — YouTube + conexão com status real
- Atalho do canal MSK Systems no YouTube no topo do painel.
- Botão Conectar projeto acompanha as etapas reais de identificação do projeto e GitHub.
- Estado `Aguardando confirmação` aparece apenas quando existe confirmação oficial pendente.
- Após GitHub confirmado, o botão passa para Publicar/Atualizar projeto de acordo com o estado real.


## v2.4.63 — envio sincronizado com anexos
Ao clicar em Enviar com imagem/arquivo ainda em preparação, o MSK aguarda o anexo ficar pronto e envia automaticamente. Se o anexo falhar, o comando não é enviado incompleto.
