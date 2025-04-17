// Popup script that handles UI interaction
document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const taskNumberElement = document.getElementById('task-number');
  const taskTitleElement = document.getElementById('task-title');
  const branchNameElement = document.getElementById('branch-name');
  const copyButton = document.getElementById('copy-button');
  const prTypeSelect = document.getElementById('pr-type');
  const statusMessage = document.getElementById('status-message');
  
  let currentTaskInfo = null;
  
  // Function to generate a branch name from task info
  function generateBranchName(taskInfo, prType) {
    if (!taskInfo || !taskInfo.number || !taskInfo.title) {
      return '-';
    }
    
    // Convert task title to kebab-case
    let titleForBranch = taskInfo.title
      // Remove special characters and convert to lowercase
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .substring(0, 80); // Limit length
    
    return `${prType}/${taskInfo.number}/${titleForBranch}`;
  }
  
  // Function to update the UI with task info
  function updateUI(taskInfo) {
    if (taskInfo) {
      taskNumberElement.textContent = taskInfo.number;
      taskTitleElement.textContent = taskInfo.title;
      
      const prType = prTypeSelect.value;
      const branchName = generateBranchName(taskInfo, prType);
      branchNameElement.textContent = branchName;
      
      currentTaskInfo = taskInfo;
    } else {
      taskNumberElement.textContent = '-';
      taskTitleElement.textContent = '-';
      branchNameElement.textContent = '-';
    }
  }
  
  // Function to display notification
  function showNotification(message, type = 'success') {
    statusMessage.textContent = message;
    
    // Apply styles based on notification type
    if (type === 'success') {
      statusMessage.style.backgroundColor = '#e6ffe6';
      statusMessage.style.border = '1px solid #99cc99';
    } else if (type === 'error') {
      statusMessage.style.backgroundColor = '#ffe6e6';
      statusMessage.style.border = '1px solid #cc9999';
    } else if (type === 'info') {
      statusMessage.style.backgroundColor = '#fff9e6';
      statusMessage.style.border = '1px solid #ccc099';
    }
    
    // Add animation class for notification
    statusMessage.classList.add('show-notification');
    
    // Remove notification after delay
    setTimeout(() => {
      statusMessage.classList.remove('show-notification');
      setTimeout(() => {
        statusMessage.textContent = '';
        statusMessage.style.backgroundColor = '';
        statusMessage.style.border = '';
      }, 300);
    }, 3000);
  }
  
  // Function to copy branch name to clipboard
  function copyBranchName() {
    const branchName = branchNameElement.textContent;
    if (branchName !== '-') {
      navigator.clipboard.writeText(branchName).then(() => {
        showNotification('Nome da branch copiado para a área de transferência!', 'success');
      }).catch(err => {
        console.error('Erro ao copiar:', err);
        showNotification('Erro ao copiar o nome da branch.', 'error');
      });
    }
  }
  
  // Event listeners
  copyButton.addEventListener('click', copyBranchName);
  
  prTypeSelect.addEventListener('change', () => {
    if (currentTaskInfo) {
      const branchName = generateBranchName(currentTaskInfo, prTypeSelect.value);
      branchNameElement.textContent = branchName;
    }
  });
  
  // Function to check if current URL is an Azure DevOps task page
  function isAzureDevOpsTaskPage(url) {
    // Verifica várias possibilidades de URLs do Azure DevOps
    const isAzureDevOps = (
      url.includes('dev.azure.com') ||
      url.includes('.visualstudio.com') ||
      url.includes('azure.microsoft.com/devops')
    );
    
    // Verifica se parece ser uma página de trabalho/tarefa
    const isTaskPage = (
      url.includes('/_workitems/edit/') ||
      url.includes('/_boards/') ||
      url.includes('workitem=') ||
      url.includes('/work-items/') ||
      url.includes('/backlogs/')
    );
    
    return isAzureDevOps && isTaskPage;
  }
  
  // Get active tab info
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    console.log('[Branch Name Generator] URL atual:', currentTab.url);
    
    // Check if we're on an Azure DevOps task page
    if (isAzureDevOpsTaskPage(currentTab.url)) {
      console.log('[Branch Name Generator] Detectada uma página de tarefa do Azure DevOps');
      
      // Envia mensagem para o content script para obter informações da tarefa
      chrome.tabs.sendMessage(
        currentTab.id,
        { action: 'getTaskInfo' },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('[Branch Name Generator] Erro ao comunicar com o content script:', chrome.runtime.lastError);
            
            // Tenta verificar se o content script está carregado
            chrome.tabs.executeScript(
              currentTab.id,
              { code: 'typeof extractTaskInfo === "function"' },
              (results) => {
                if (chrome.runtime.lastError || !results || results[0] !== true) {
                  showNotification('A extensão não está ativa nesta página. Tente recarregar a página.', 'error');
                }
              }
            );
            return;
          }
          
          if (response) {
            console.log('[Branch Name Generator] Resposta do content script:', response);
            updateUI(response);
          } else {
            console.log('[Branch Name Generator] Content script não retornou dados');
            showNotification('Não foi possível extrair as informações da tarefa. Tente recarregar a página.', 'error');
          }
        }
      );
    } else {
      // Not on a task page
      console.log('[Branch Name Generator] Não é uma página de tarefa do Azure DevOps');
      showNotification('Esta extensão só funciona em páginas de tarefas do Azure DevOps.', 'info');
    }
  });
  
  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'taskInfoExtracted') {
      console.log('[Branch Name Generator] Recebidas informações do content script:', request.data);
      updateUI(request.data);
    }
  });
});