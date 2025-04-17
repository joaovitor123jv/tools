const { execSync } = require('child_process');
const fs = require('fs');

// Configure aqui a URL base para os cards do Azure DevOps
const BASE_URL = 'https://dev.azure.com/sua-organizacao/seu-projeto/_workitems/edit';

// Exemplo: https://dev.azure.com/blabla-co/blabla/_workitems/edit

function extractCardNumbersFromBranch(branchName) {
  // Padrão típico: hotfix/4350/blabla-shop...
  const regex = /(hotfix|fix|chore|feat|feature)\/(\d+)(?:\/|$)/;
  const match = branchName.match(regex);
  return match ? [match[2]] : [];
}

function extractAllCardNumbersFromMessage(message) {
  // Padrão típico em commits do Azure DevOps: "Related work items: #4350"
  const workItemRegex = /Related work items:\s*#(\d+)/g;
  const workItemMatches = [...message.matchAll(workItemRegex)];
  const workItemNumbers = workItemMatches.map(match => match[1]);
  
  // Também verifica o padrão AB#XXXX nos comentários
  const abRegex = /AB#(\d+)/g;
  const abMatches = [...message.matchAll(abRegex)];
  const abNumbers = abMatches.map(match => match[1]);
  
  // Combina e remove duplicatas
  return [...new Set([...workItemNumbers, ...abNumbers])];
}

function extractPRNumberFromMessage(message) {
  // Padrão do Azure DevOps: "Merged PR 2155: ..."
  const regex = /Merged PR (\d+):/i;
  const match = message.match(regex);
  return match ? match[1] : null;
}

function sortTagsDescending(tags) {
  return tags.sort((a, b) => {
    // Remove 'v' prefix if exists
    const aClean = a.replace(/^v/, '');
    const bClean = b.replace(/^v/, '');
    
    // Split by dots to compare each version segment
    const aParts = aClean.split('.').map(Number);
    const bParts = bClean.split('.').map(Number);
    
    // Compare major version
    if (aParts[0] !== bParts[0]) return bParts[0] - aParts[0];
    // Compare minor version
    if (aParts[1] !== bParts[1]) return bParts[1] - aParts[1];
    // Compare patch version
    return bParts[2] - aParts[2];
  });
}

function getAllBranchesFromMergeCommit(commitHash) {
  try {
    // Obtém a mensagem completa do merge commit
    const commitMsg = execSync(`git show -s --format=%B ${commitHash}`).toString().trim();
    const branches = [];
    
    // Extrai branches de mensagens de merge do formato: "Merge branch 'feature/123-descricao' into main"
    const branchMatches = commitMsg.match(/Merge branch ['"]([^'"]+)['"]/g);
    if (branchMatches) {
      branchMatches.forEach(match => {
        const branchName = match.replace(/Merge branch ['"]([^'"]+)['"]/, '$1');
        branches.push(branchName);
      });
    }
    
    // Extrai branches do formato: "Merged PR XXX: from branch/name"
    const prFromMatches = commitMsg.match(/from\s+([^\/\s]+\/[^\s'"]+)/g);
    if (prFromMatches) {
      prFromMatches.forEach(match => {
        const branchName = match.replace(/from\s+/, '');
        branches.push(branchName.replace(/^(origin|upstream)\//, ''));
      });
    }
    
    // Verifica refs do commit para pegar nomes de branches
    try {
      const refs = execSync(`git branch -r --contains ${commitHash}`).toString().trim().split('\n');
      refs.forEach(ref => {
        const branchName = ref.trim().replace(/^origin\//, '');
        // Filtra apenas branches que parecem ser de feature/fix/etc
        if (/^(feature|fix|hotfix|chore|feat)\//.test(branchName) && !branches.includes(branchName)) {
          branches.push(branchName);
        }
      });
    } catch (e) {
      // Ignora erro se não encontrar refs remotas
    }
    
    return branches;
  } catch (error) {
    return [];
  }
}

// function getAllMergeCommitsBetweenTags(startTag, endTag) {
//   try {
//     // Se não tiver startTag, pegar todos os commits até endTag
//     const range = startTag ? `${startTag}..${endTag}` : endTag;
    
//     // Pega todos os merge commits nesse intervalo
//     const output = execSync(`git log --merges --pretty=format:"%H" ${range}`).toString().trim();
    
//     if (!output) return [];
    
//     return output.split('\n');
//   } catch (error) {
//     console.error(`Erro ao obter merge commits entre ${startTag || 'início'} e ${endTag}:`, error.message);
//     return [];
//   }
// }

function extractRelatedItemsFromCommitMessages(commitHash) {
  try {
    // Busca detalhadamente por work items e PRs nos comentários do commit
    const fullCommitMessage = execSync(`git show -s --format=%B ${commitHash}`).toString();
    
    const cards = extractAllCardNumbersFromMessage(fullCommitMessage);
    const prNumber = extractPRNumberFromMessage(fullCommitMessage);
    
    return { cards, prNumber };
  } catch (error) {
    return { cards: [], prNumber: null };
  }
}

function getDeploymentInfo() {
  console.log('Coletando informações de deployment...');
  
  try {
    // Obtém todas as tags
    const tagsOutput = execSync('git tag').toString().trim();
    if (!tagsOutput) {
      console.log('Nenhuma tag encontrada no repositório.');
      return [];
    }
    
    const tags = tagsOutput.split('\n');
    // Ordena as tags em ordem decrescente (semver)
    const sortedTags = sortTagsDescending(tags);
    const deployments = [];

    // Obtém o primeiro commit do repositório para usar como fallback
    let firstCommit = '';
    try {
      firstCommit = execSync('git rev-list --max-parents=0 HEAD').toString().trim();
    } catch (e) {
      // Ignora erro
    }

    for (let i = 0; i < sortedTags.length; i++) {
      const tag = sortedTags[i];
      
      try {
        // Obtém o hash do commit associado à tag
        const commitHash = execSync(`git rev-list -n 1 ${tag}`).toString().trim();
        
        // Obtém a data do commit formatada
        const date = execSync(`git show -s --format=%cd --date=iso ${commitHash}`).toString().trim();
        
        // Verifica se o commit está na branch main
        const isInMain = Boolean(execSync(`git branch --contains ${commitHash} | grep -E '\\bmain\\b|\\bmaster\\b'`).toString().trim());
        
        // Obtém a mensagem completa do commit da tag
        const commitMessage = execSync(`git show -s --format=%B ${commitHash}`).toString().trim();
        
        // Extrai informações diretamente do commit da tag
        const { cards: cardsFromTag, prNumber } = extractRelatedItemsFromCommitMessages(commitHash);
        
        // Determina a tag anterior para analisar commits intermediários
        const previousTag = i < sortedTags.length - 1 ? sortedTags[i + 1] : null;
        
        // Se não encontrou uma tag anterior, define um limite de tempo (90 dias)
        let range = '';
        if (previousTag) {
          range = `${previousTag}..${tag}`;
        } else {
          // Se não tiver tag anterior, usa um range de 90 dias ou o primeiro commit
          if (firstCommit) {
            range = `${firstCommit}..${tag}`;
          } else {
            // Fallback: últimos 90 dias
            range = `${tag}~500..${tag}`;  // aproximadamente 500 commits
          }
        }
        
        // Coleta todos os commits de merge nesse intervalo
        const mergeCommits = [];
        try {
          const mergesOutput = execSync(`git log --merges --pretty=format:"%H" ${range}`).toString().trim();
          if (mergesOutput) {
            mergeCommits.push(...mergesOutput.split('\n'));
          }
        } catch (e) {
          // Ignora erro e segue
        }
        
        // Armazena informações de branches e cards
        const branchesInfo = [];
        const allCardNumbers = new Set(cardsFromTag); // Inicia com os cards já coletados na tag
        
        // Extrai informações de cada merge commit
        for (const mergeCommit of mergeCommits) {
          // Obtém mensagem do commit para buscar work items
          const { cards, prNumber: commitPrNumber } = extractRelatedItemsFromCommitMessages(mergeCommit);
          cards.forEach(card => allCardNumbers.add(card));
          
          // Procura branches associadas a este merge
          const branches = getAllBranchesFromMergeCommit(mergeCommit);
          branches.forEach(branch => {
            // Extrai números de card do nome da branch
            const cardsFromBranch = extractCardNumbersFromBranch(branch);
            cardsFromBranch.forEach(card => allCardNumbers.add(card));
            
            // Adiciona a branch à lista se ainda não estiver
            if (!branchesInfo.some(b => b === branch)) {
              branchesInfo.push(branch);
            }
          });
        }
        
        // Faz uma pesquisa final por branches que contêm este commit
        try {
          // Obtém todas as branches que contêm este commit
          const containingBranches = execSync(`git branch -a --contains ${commitHash}`).toString().trim().split('\n');
          
          containingBranches.forEach(branchLine => {
            // Remove caracteres de formatação e prefixos
            const branch = branchLine.replace(/^\*?\s+/, '').replace(/^remotes\/origin\//, '');
            
            // Filtra apenas branches de feature/fix/etc
            if (/^(feature|fix|hotfix|chore|feat)\//.test(branch) && !branchesInfo.includes(branch)) {
              branchesInfo.push(branch);
              
              // Extrai cards do nome da branch
              const cardsFromBranch = extractCardNumbersFromBranch(branch);
              cardsFromBranch.forEach(card => allCardNumbers.add(card));
            }
          });
        } catch (e) {
          // Ignora erros nessa etapa
        }
        
        deployments.push({
          tag,
          date,
          isMainCommit: isInMain,
          cardNumbers: Array.from(allCardNumbers),
          prNumber,
          branches: branchesInfo,
          commitMessage
        });
      } catch (error) {
        console.error(`Erro ao processar tag ${tag}:`, error);
      }
    }

    return deployments;
    
  } catch (error) {
    console.error('Erro ao coletar informações de deployment:', error);
    return [];
  }
}

function formatCardsWithLineBreaks(cards, maxPerLine = 5) {
  if (!cards.length) return 'N/A';
  
  const lines = [];
  for (let i = 0; i < cards.length; i += maxPerLine) {
    // Pega até maxPerLine cards e junta com vírgula
    lines.push(cards.slice(i, i + maxPerLine).join(', '));
  }
  return lines.join('\n');
}

function formatCardsWithLinks(cards, maxPerLine = 5) {
  if (!cards.length) return 'N/A';
  
  const lines = [];
  for (let i = 0; i < cards.length; i += maxPerLine) {
    // Pega até maxPerLine cards, transforma cada um em um link e junta com vírgula
    const lineCards = cards.slice(i, i + maxPerLine).map(card => 
      `<a href="${BASE_URL}/${card}" target="_blank" class="card-link">${card}</a>`
    );
    lines.push(lineCards.join(', '));
  }
  return lines.join('<br>');
}

function main() {
  const deployments = getDeploymentInfo();
  
  if (deployments.length === 0) {
    console.log('Não foram encontradas informações de deployment.');
    return;
  }
  
  // Formata a saída como tabela para o console
  console.log('\nInformações de deployment:\n');
  console.log('Tag | Data | Na Main? | Cards | PR | Branches');
  console.log('-'.repeat(120));
  
  deployments.forEach(d => {
    const cards = formatCardsWithLineBreaks(d.cardNumbers);
    const branches = d.branches.length > 0 ? d.branches.join('\n') : 'N/A';
    console.log(`${d.tag} | ${d.date} | ${d.isMainCommit ? 'Sim' : 'Não'} | ${cards.replace(/\n/g, ', ')} | ${d.prNumber || 'N/A'} | ${branches.replace(/\n/g, ', ')}`);
  });
  
  // Exporta para CSV para análise mais detalhada
  const csvContent = [
    'Tag,Data,Na Main,Cards,PR,Branches,Mensagem do Commit',
    ...deployments.map(d => {
      const cards = formatCardsWithLineBreaks(d.cardNumbers);
      const branches = d.branches.length > 0 ? d.branches.join('\n') : '';
      return `"${d.tag}","${d.date}","${d.isMainCommit ? 'Sim' : 'Não'}","${cards.replace(/\n/g, '\r\n')}","${d.prNumber || ''}","${branches}","${d.commitMessage.replace(/"/g, '""')}"`;
    }),
  ].join('\n');
  
  fs.writeFileSync('deployment-info.csv', csvContent, 'utf8');
  console.log('\nDados exportados para deployment-info.csv');
  
  // Gerar um relatório HTML com formatação melhor para visualização
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Informações de Deployment</title>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; position: sticky; top: 0; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .branch-list { white-space: pre-line; }
    .card-list { white-space: pre-line; }
    h1 { margin-bottom: 20px; color: #333; }
    .summary { margin: 20px 0; background: #f8f8f8; padding: 15px; border-radius: 5px; }
    .summary p { margin: 5px 0; }
    .card-highlight { font-weight: bold; color: #0066cc; }
    .search-container { margin: 20px 0; }
    .search-input { padding: 8px; width: 300px; }
    #reset-button, #search-button { padding: 8px 15px; margin-left: 10px; cursor: pointer; }
    .card-link { color: #0066cc; text-decoration: none; font-weight: bold; }
    .card-link:hover { text-decoration: underline; }
    .config-section { margin: 20px 0; background: #e9f7fe; padding: 15px; border-radius: 5px; border: 1px solid #bde5f8; }
    .config-section code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
  </style>
</head>
<body>
  <h1>Informações de Deployment</h1>
  
  <div class="config-section">
    <p><strong>URL base para cards:</strong> <code>${BASE_URL}</code></p>
    <p><em>Para alterar a URL base, modifique a constante BASE_URL no início do arquivo deploy-info.js</em></p>
  </div>
  
  <div class="summary">
    <p><strong>Total de deployments:</strong> ${deployments.length}</p>
    <p><strong>Período:</strong> ${deployments.length > 0 ? 
      `${deployments[deployments.length-1].date} até ${deployments[0].date}` : 'N/A'}</p>
  </div>
  
  <div class="search-container">
    <input type="text" id="searchInput" class="search-input" placeholder="Buscar por card, branch ou tag...">
    <button id="search-button" onclick="searchTable()">Buscar</button>
    <button id="reset-button" onclick="resetSearch()">Limpar</button>
  </div>
  
  <table id="deploymentTable">
    <thead>
      <tr>
        <th>Tag</th>
        <th>Data</th>
        <th>Cards</th>
        <th>PR</th>
        <th>Branches</th>
      </tr>
    </thead>
    <tbody>
    ${deployments.map(d => {
      const cards = formatCardsWithLinks(d.cardNumbers);
      const branches = d.branches.length > 0 ? d.branches.join('<br>') : 'N/A';
      return `
      <tr>
        <td>${d.tag}</td>
        <td>${d.date}</td>
        <td class="card-list card-highlight">${cards}</td>
        <td>${d.prNumber ? `<a href="${BASE_URL}/${d.prNumber}" target="_blank" class="card-link">${d.prNumber}</a>` : 'N/A'}</td>
        <td class="branch-list">${branches}</td>
      </tr>
    `}).join('')}
    </tbody>
  </table>

  <script>
    function searchTable() {
      const input = document.getElementById('searchInput').value.toLowerCase();
      const table = document.getElementById('deploymentTable');
      const rows = table.getElementsByTagName('tr');
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const text = row.textContent.toLowerCase();
        
        if (text.includes(input)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      }
    }
    
    function resetSearch() {
      document.getElementById('searchInput').value = '';
      const table = document.getElementById('deploymentTable');
      const rows = table.getElementsByTagName('tr');
      
      for (let i = 1; i < rows.length; i++) {
        rows[i].style.display = '';
      }
    }
  </script>
</body>
</html>
`;

  fs.writeFileSync('deployment-info.html', htmlContent, 'utf8');
  console.log('Relatório HTML gerado: deployment-info.html');
}

main();