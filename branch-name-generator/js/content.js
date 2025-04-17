// Script that runs on Azure DevOps task pages
(() => {
  // Function to extract task information using multiple strategies
  function extractTaskInfo() {
    try {
      console.log('[Branch Name Generator] Iniciando extração de informações da tarefa...');
      
      // Variáveis para armazenar os resultados
      let taskNumber = '';
      let taskTitle = '';
      
      // ----- ESTRATÉGIA 1: URL da página -----
      console.log('[Branch Name Generator] Estratégia 1: Extração da URL');
      const url = window.location.href;
      console.log('[Branch Name Generator] URL atual:', url);
      
      // Padrão comum para Work Items do Azure DevOps: /_workitems/edit/12345
      const workItemRegex = /\/_workitems\/edit\/(\d+)/i;
      const workItemMatch = url.match(workItemRegex);
      
      if (workItemMatch && workItemMatch[1]) {
        taskNumber = workItemMatch[1];
        console.log('[Branch Name Generator] ID da tarefa extraído da URL:', taskNumber);
      } else {
        // Padrão alternativo: /?workitem=12345
        const workItemParamRegex = /[?&]workitem=(\d+)/i;
        const workItemParamMatch = url.match(workItemParamRegex);
        
        if (workItemParamMatch && workItemParamMatch[1]) {
          taskNumber = workItemParamMatch[1];
          console.log('[Branch Name Generator] ID da tarefa extraído do parâmetro URL:', taskNumber);
        } else {
          console.log('[Branch Name Generator] ID da tarefa não encontrado na URL');
        }
      }
      
      // ----- ESTRATÉGIA 2: Título na página -----
      console.log('[Branch Name Generator] Estratégia 2: Busca por elementos de título');
      
      // Tentativa 1: Campo de título em modo de edição
      const titleInputs = [
        document.querySelector('input[aria-label="Title field"]'),
        document.querySelector('input.work-item-title-field'),
        document.querySelector('.work-item-form-title input'),
        document.querySelector('.work-item-title input')
      ].filter(el => el && el.value);
      
      if (titleInputs.length > 0) {
        taskTitle = titleInputs[0].value.trim();
        console.log('[Branch Name Generator] Título encontrado em campo de input:', taskTitle);
      } else {
        // Tentativa 2: Título em modo de visualização (span/div)
        const titleElements = [
          document.querySelector('.work-item-form-title'),
          document.querySelector('.work-item-title'),
          document.querySelector('.wit-title'),
          document.querySelector('[aria-label="Title"]'),
          document.querySelector('[data-id="title-control"]'),
          document.querySelector('.title-control')
        ].filter(el => el && el.textContent);
        
        if (titleElements.length > 0) {
          taskTitle = titleElements[0].textContent.trim();
          console.log('[Branch Name Generator] Título encontrado em elemento de texto:', taskTitle);
        }
      }
      
      // ----- ESTRATÉGIA 3: Busca no DOM por texto visível do número da task -----
      if (!taskNumber) {
        console.log('[Branch Name Generator] Estratégia 3: Busca por número de task no DOM');
        
        // Muitas vezes o número está no breadcrumb ou no header
        const headers = document.querySelectorAll('.work-item-header, .work-item-form-header, .work-item-id');
        
        headers.forEach(header => {
          if (!taskNumber && header.textContent) {
            const idMatch = header.textContent.match(/\b(\d{3,7})\b/); // IDs típicos do Azure DevOps
            if (idMatch) {
              taskNumber = idMatch[1];
              console.log('[Branch Name Generator] Número da tarefa encontrado no header:', taskNumber);
            }
          }
        });
        
        // Tenta encontrar em qualquer elemento de texto que parece um ID de task
        if (!taskNumber) {
          const allText = document.body.textContent;
          const idMatches = [...allText.matchAll(/\b(\d{3,7})\b/g)];
          if (idMatches.length > 0) {
            // Pega o primeiro ID numérico encontrado
            taskNumber = idMatches[0][1];
            console.log('[Branch Name Generator] Possível número de tarefa encontrado no texto da página:', taskNumber);
          }
        }
      }
      
      // ----- ESTRATÉGIA 4: Título do documento -----
      if (!taskTitle || !taskNumber) {
        console.log('[Branch Name Generator] Estratégia 4: Extraindo do título do documento');
        const docTitle = document.title;
        console.log('[Branch Name Generator] Título do documento:', docTitle);
        
        // Padrão comum para títulos de páginas do Azure DevOps: "#12345 - Título da tarefa"
        const titleMatch = docTitle.match(/[#]?(\d+)[:\s-]+(.+)/);
        if (titleMatch) {
          if (!taskNumber) {
            taskNumber = titleMatch[1];
            console.log('[Branch Name Generator] ID da tarefa extraído do título do documento:', taskNumber);
          }
          
          if (!taskTitle) {
            taskTitle = titleMatch[2].trim();
            console.log('[Branch Name Generator] Título da tarefa extraído do título do documento:', taskTitle);
          }
        }
      }
      
      // Verifica se conseguimos as informações
      if (!taskNumber && !taskTitle) {
        console.log('[Branch Name Generator] Não foi possível extrair informações da tarefa');
        // Dump do HTML para depuração
        console.log('[Branch Name Generator] HTML da página:', document.documentElement.innerHTML.substring(0, 1000) + '...');
        return null;
      }
      
      const result = {
        number: taskNumber || 'unknown',
        title: taskTitle || 'unknown-task'
      };
      
      console.log('[Branch Name Generator] Extração finalizada:', result);
      return result;
    } catch (error) {
      console.error('[Branch Name Generator] Erro durante a extração de informações:', error);
      return null;
    }
  }

  // Function to listen for messages from the popup
  function handleMessage(request, sender, sendResponse) {
    if (request.action === 'getTaskInfo') {
      console.log('[Branch Name Generator] Recebida solicitação para extrair informações da tarefa');
      const taskInfo = extractTaskInfo();
      sendResponse(taskInfo);
    }
  }

  // Set up message listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request, sender, sendResponse);
    return true; // Mantém a conexão aberta para respostas assíncronas
  });

  // Extrai informações quando a página estiver carregada
  function extractAndSendInfo() {
    console.log('[Branch Name Generator] Tentando extração após carregamento');
    const taskInfo = extractTaskInfo();
    if (taskInfo) {
      console.log('[Branch Name Generator] Enviando informações extraídas para o popup');
      chrome.runtime.sendMessage({
        action: 'taskInfoExtracted',
        data: taskInfo
      });
    }
  }

  // Extrai na carga inicial e após algum tempo para garantir que o DOM foi carregado
  window.addEventListener('load', () => {
    console.log('[Branch Name Generator] Página carregada, aguardando elementos DOM...');
    
    // Primeira tentativa imediata
    extractAndSendInfo();
    
    // Segunda tentativa após um segundo
    setTimeout(extractAndSendInfo, 1000);
    
    // Terceira tentativa após 3 segundos (para carregamentos lentos)
    setTimeout(extractAndSendInfo, 3000);
  });

  // Re-extrai quando a URL muda (navegação SPA)
  let lastUrl = window.location.href;
  setInterval(() => {
    if (lastUrl !== window.location.href) {
      console.log('[Branch Name Generator] URL mudou, re-extraindo informações');
      lastUrl = window.location.href;
      
      // Espera um momento para o DOM atualizar
      setTimeout(extractAndSendInfo, 1000);
    }
  }, 1000);

  // Observa mudanças no DOM que possam indicar carregamento de conteúdo
  const observer = new MutationObserver((mutations) => {
    // Verifica se as mudanças são relevantes
    const relevantChanges = mutations.some(mutation => {
      return mutation.addedNodes.length > 0 && 
             Array.from(mutation.addedNodes).some(node => 
               node.nodeType === Node.ELEMENT_NODE && 
               (node.classList?.contains('work-item-form') || 
                node.querySelector('.work-item-form, .work-item-title')));
    });
    
    if (relevantChanges) {
      console.log('[Branch Name Generator] Detectada mudança relevante no DOM');
      extractAndSendInfo();
    }
  });

  // Inicia a observação
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('[Branch Name Generator] Content script carregado e funcionando');
})();