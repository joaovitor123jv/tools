# Deploy Tracker

1. Altere a variável `BASE_URL` do arquivo deploy-info.js
2. Adicione na raiz do projeto que quer visualizar o histórico de deploy
3. Vá para a branch principal (main) e execute `node deploy-info.js`
4. Abra o relatório `deployment-info.html` com seu navegador, ou o `deployment-info.csv` com seu leitor de planilhas de preferência


Como ele funciona?
- Considera cada tag como 1 deploy (usando SemVer)
- Considera que o número do card está no corpo da branch (`feat/NUMERO_DO_CARD/qualquercoisa`)
- Considera que o número do PR está na mensagem de commit `Merged PR NUMERO_DO_PR: Qualquer coisa aqui`

O que preciso ter pra funcionar?
- Um diretório git
- O git
- Node
