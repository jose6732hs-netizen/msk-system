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
