# Direcionamento automático para a licença de teste

## Objetivo
Garantir que quem clicar para obter a licença de teste chegue diretamente ao local correto do painel, inclusive quando precisar entrar ou criar uma conta primeiro.

## Implementação
- Preservar a intenção de abrir a licença FREE durante login por senha, cadastro e login social.
- Após autenticar, abrir o painel já na aba **Licença FREE** e rolar até essa área.
- Se o teste já estiver disponível, mostrar a licença completa com o botão **Copiar token** sem exigir nova geração.
- Após gerar uma licença FREE, manter a pessoa posicionada exatamente no bloco onde o token pode ser copiado.
- Manter os fluxos atuais de licenças pagas e demais ofertas sem alterações.

## Validação
- Testar acesso direto estando autenticado.
- Testar clique deslogado, autenticação e retorno automático ao ponto correto.
- Testar licença FREE nova, pendente e em andamento em telas desktop e mobile.
