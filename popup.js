let OPENROUTER_API_KEY = null;
let recognition;
let isListening = false;

const micButton = document.getElementById('micButton');
const statusDiv = document.getElementById('status');
const transcriptDiv = document.getElementById('transcript');

navigator.mediaDevices.getUserMedia({ audio: true })

// Load API key from Chrome storage
chrome.storage.sync.get(['openrouterApiKey'], (result) => {
  OPENROUTER_API_KEY = result.openrouterApiKey;
  
  if (!OPENROUTER_API_KEY) {
    statusDiv.textContent = 'Configuration Error';
    transcriptDiv.textContent = 'API key not found. Please set it in the extension options.';
    micButton.disabled = true;
  }
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  statusDiv.textContent = 'Not Supported';
  transcriptDiv.textContent = 'Speech recognition is not supported in this browser.';
  micButton.disabled = true;
} else {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isListening = true;
    micButton.classList.add('listening');
    statusDiv.textContent = 'Listening...';
    transcriptDiv.textContent = 'Speak clearly into your mic';
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

  recognition.onerror = (event) => {
    statusDiv.textContent = 'Error Occurred';
    transcriptDiv.textContent = `System: ${event.error}`;
  };
}

micButton.addEventListener('click', () => {
  if (isListening) recognition.stop();
  else recognition.start();
});

async function processCommand(transcript) {
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
          content: `You are a command parser. Convert the voice command to JSON.
          Actions: zoom (in/out), scroll (up/down), volume (up/down), tab (next/previous), refresh.
          Command: "${transcript}"
          Output only valid JSON, for example: {"action": "zoom", "direction": "in", "amount": 10}`
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'API Request Failed');
    }

    const commandText = data.choices[0].message.content.trim();
    const jsonMatch = commandText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        const command = JSON.parse(jsonMatch[0]);
        await executeCommand(command);
      } catch (e) {
        statusDiv.textContent = 'Parse Error';
        transcriptDiv.textContent = 'The AI returned an invalid command format.';
      }
    } else {
      statusDiv.textContent = 'Unknown Command';
      transcriptDiv.textContent = "I couldn't match that to an action.";
    }
  } catch (error) {
    statusDiv.textContent = 'API Error';
    transcriptDiv.textContent = error.message;
  }
}

async function executeCommand(command) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) return;

  chrome.tabs.sendMessage(tab.id, { command }, (response) => {
    console.log("Command action: " + command.action);
    if(command.action === 'volume'){
      console.log("Check");
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "changeVolume",
          amount: command.direction === 'up'
            ? command.amount
            : -command.amount
        });
      });    }
    if (chrome.runtime.lastError) {
      if (command.action === 'zoom' || command.action === 'tab') {
          chrome.runtime.sendMessage({
            type: command.action === 'zoom' ? 'zoom' : 'tabControl',
            direction: command.direction,
            amount: command.amount
          });
          statusDiv.textContent = 'Success';
          transcriptDiv.textContent = `Applied ${command.action} successfully.`;
      } else {
        statusDiv.textContent = 'Blocked';
        transcriptDiv.textContent = 'Commands are restricted on this specific page.';
      }
    } else {
      statusDiv.textContent = 'Success';
      transcriptDiv.textContent = `Command "${command.action}" executed.`;
    }
    
    setTimeout(() => {
      statusDiv.textContent = 'Ready';
    }, 2500);
  });
}