let OPENROUTER_API_KEY = null;
let recognition;
let isListening = false;

const micButton = document.getElementById('micButton');
const statusDiv = document.getElementById('status');
const transcriptDiv = document.getElementById('transcript');

chrome.storage.sync.get(['openrouterApiKey'], (result) => {
  OPENROUTER_API_KEY = result.openrouterApiKey;
  if (!OPENROUTER_API_KEY) {
    statusDiv.textContent = 'Config Error';
    micButton.disabled = true;
  }
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isListening = true;
    micButton.classList.add('listening');
    statusDiv.textContent = 'Listening...';
  };

  recognition.onend = () => {
    isListening = false;
    micButton.classList.remove('listening');
  };

  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    transcriptDiv.textContent = `"${transcript}"`;
    statusDiv.textContent = 'Processing...';
    await processCommand(transcript);
  };
}

micButton.addEventListener('click', () => {
  if (isListening) recognition.stop();
  else recognition.start();
});

async function processCommand(transcript) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const screenshotUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 40 });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a command parser. Convert the voice command to JSON with this EXACT structure:
              
              For browser commands:
              {"action": "zoom", "direction": "in/out", "amount": 1}
              {"action": "scroll", "direction": "up/down/top/bottom/next", "amount": 1}
              {"action": "volume", "direction": "up/down", "amount": 10}
              {"action": "tab", "direction": "next/previous"}
              {"action": "refresh"}
              
              For search (ONLY if user says "google/find/search"):
              {"action": "search", "query": "search terms"}
              
              For clicking links (if user says "click X" or "open X" or "press X"):
              {"action": "click", "query": "link text to find", "point": [y, x]}
              (point is normalized 0-1000 coordinates of the EXACT CENTER of the clickable element)
              
              For location questions (where is X):
              {"action": "locate", "query": "what user asked", "point": [y, x]}
              (point is normalized 0-1000 coordinates of the CENTER of the item)
              
              For questions about screen content:
              {"action": "other", "query": "what user asked", "point": [y, x]}
              (Include "point" ONLY if asking about a specific location)
              
              Command: "${transcript}"
              
              IMPORTANT: Return ONLY the JSON object, no markdown, no explanation.`
            },
            { type: 'image_url', image_url: { url: screenshotUrl } }
          ]
        }]
      })
    });

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    console.log('LLM Response:', content);
    
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    let command;
    try {
      command = JSON.parse(content);
      console.log('Parsed command:', command);
    } catch (e) {
      console.error('JSON parse error:', e);
      statusDiv.textContent = 'Parse Error';
      return;
    }
    
    if (command.action === 'locate') {
      if (command.point && Array.isArray(command.point) && command.point.length === 2) {
        console.log('LOCATE: Drawing circle at:', command.point);
        chrome.tabs.sendMessage(tab.id, { 
          type: "drawCircle", 
          y: command.point[0], 
          x: command.point[1] 
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('LOCATE: Circle draw error:', chrome.runtime.lastError);
          } else {
            console.log('LOCATE: Circle draw response:', response);
          }
        });
      } else {
        console.error('LOCATE: No valid point provided:', command.point);
      }
      
      // Send to background for voice response
      console.log('LOCATE: Sending to background for voice response');
      chrome.runtime.sendMessage({ 
        type: 'other', 
        query: command.query || transcript,
        image: screenshotUrl,
        tabId: tab.id
      });
      
    } else if (command.action === 'click') {
      console.log('CLICK: Clicking link:', command.query, 'at point:', command.point);
      
      if (command.point && Array.isArray(command.point) && command.point.length === 2) {
        console.log('CLICK: Using coordinates to click');
        chrome.tabs.sendMessage(tab.id, { 
          type: "clickAtCoordinates",
          point: command.point
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('CLICK: Click error:', chrome.runtime.lastError);
            console.error('CLICK: This usually means content script is not loaded. Trying to inject...');
            
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['dist/modifypage.js']
            }, () => {
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { 
                  type: "clickAtCoordinates",
                  point: command.point
                }, (retryResponse) => {
                  console.log('CLICK: Retry response:', retryResponse);
                });
              }, 100);
            });
          } else {
            console.log('CLICK: Click response:', response);
          }
        });
      } else {
        console.log('CLICK: No coordinates, falling back to text search');
        chrome.tabs.sendMessage(tab.id, { 
          type: "clickLink",
          query: command.query,
          useTextSearch: true
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('CLICK: Click error:', chrome.runtime.lastError);
          } else {
            console.log('CLICK: Click response:', response);
          }
        });
      }
      
    } else if (command.action === 'other') {
      if (command.point && Array.isArray(command.point) && command.point.length === 2) {
        console.log('Drawing circle at:', command.point);
        chrome.tabs.sendMessage(tab.id, { 
          type: "drawCircle", 
          y: command.point[0], 
          x: command.point[1] 
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Circle draw error:', chrome.runtime.lastError);
          } else {
            console.log('Circle draw response:', response);
          }
        });
      }
      
      console.log('Sending question to background for voice response');
      chrome.runtime.sendMessage({ 
        type: 'other', 
        query: command.query || transcript,
        image: screenshotUrl,
        tabId: tab.id
      });
      
    } else if (command.action === 'search') {
      chrome.runtime.sendMessage({ type: 'search', query: command.query });
      
    } else {
      chrome.tabs.sendMessage(tab.id, { command });
      
      if (['zoom', 'tab', 'volume'].includes(command.action)) {
        chrome.runtime.sendMessage({
          type: command.action === 'zoom' ? 'zoom' : (command.action === 'tab' ? 'tabControl' : 'volume'),
          direction: command.direction,
          amount: command.amount
        });
      }
    }
    
    statusDiv.textContent = 'Success';
    
  } catch (error) {
    console.error('Command processing error:', error);
    statusDiv.textContent = 'Error';
  }
}