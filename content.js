OPENROUTER_API_KEY = null;

chrome.storage.sync.get(['openrouterApiKey'], (result) => {
  OPENROUTER_API_KEY = result.openrouterApiKey;
  
  if (!OPENROUTER_API_KEY) {
    statusDiv.textContent = 'Configuration Error';
    transcriptDiv.textContent = 'API key not found. Please set it in the extension options.';
    micButton.disabled = true;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command) {
    const command = request.command;
    
    if (command.action === 'zoom' || command.action === 'tab') {
      chrome.runtime.sendMessage({
        type: command.action === 'zoom' ? 'zoom' : 'tabControl',
        direction: command.direction,
        amount: command.amount
      });
      sendResponse({ status: 'Command relayed' });
    } else {
      executeDOMCommand(command);
      sendResponse({ status: 'Executed' });
    }
  }
  return true;
});

function executeDOMCommand(command) {
  switch (command.action) {
    case 'scroll':
      const scrollAmt = command.amount || 300;
      window.scrollBy({ 
        top: command.direction === 'down' ? scrollAmt : -scrollAmt, 
        behavior: 'smooth' 
      });
      break;
    case 'volume':
      if(command.direction === 'up'){
        chrome.runtime.sendMessage({ action: "changeVolume", mode: 1 });
      }
      break;
    case 'refresh':
      location.reload();
      break;
    default:
        // Ask the chatbot what to do with the user's question (we don't recognize the command)

  }
}

async function processRequest(transcript) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://github.com/OleHo370/voice-commander',
        'X-Title': 'Voice Commander'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001', 
        messages: [{
          role: 'user',
          content: `You are an AI assistant, aimed to help elderly users without tech experience to navigate the web. 
          Respond to the user's quesitions in a simple, friendly, and concise manner, avoiding technical jargon. 
          If you don't know the answer or are unable to help, admit it instead of making something up.
          Question: "${transcript}"`
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'API Request Failed');
    }

    const responseText = data.choices[0].message.content.trim();
    console.log(responseText);
  } catch (error) {
    statusDiv.textContent = 'API Error';
    transcriptDiv.textContent = error.message;
  }
}