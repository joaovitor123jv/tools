# Branch Name Generator para Azure DevOps

Esta extensão para o Google Chrome gera nomes de branches padronizados para tarefas do Azure DevOps.

## Funcionalidades

- Extrai automaticamente o número e título da tarefa do Azure DevOps
- Permite selecionar o tipo de PR (hotfix, fix, feat, chore)
- Gera o nome da branch no formato: `{TIPO_PR}/{NUMERO_TASK}/{TITULO_CARTAO}`
- Fornece um botão para copiar o nome da branch para a área de transferência

## Como usar

1. Navegue até uma página de tarefa do Azure DevOps (URL no formato https://dev.azure.com/*/workitems/edit/*)
2. Clique no ícone da extensão na barra de ferramentas do Chrome
3. Selecione o tipo de PR desejado no dropdown
4. Clique em "Copiar" para copiar o nome da branch para a área de transferência

## Instalação

### Instalação para desenvolvimento

1. Clone ou baixe este repositório
2. Abra o Chrome e acesse `chrome://extensions/`
3. Ative o "Modo do desenvolvedor" no canto superior direito
4. Clique em "Carregar sem compactação" e selecione a pasta deste projeto
5. A extensão será adicionada ao Chrome e estará pronta para uso

### Requisitos de ícones

Para que a extensão funcione corretamente, você precisa adicionar três arquivos de ícone:
- `images/icon16.png` (16x16 pixels)
- `images/icon48.png` (48x48 pixels)
- `images/icon128.png` (128x128 pixels)

## Observações

Esta extensão foi projetada especificamente para funcionar com o Azure DevOps e depende da estrutura do DOM das páginas de tarefa. Se o Azure DevOps alterar sua interface, a extensão pode precisar de atualizações.