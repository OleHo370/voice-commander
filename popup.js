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
    console.error('Speech Error:', event.error);
    if (event.error === 'not-allowed') {
      statusDiv.textContent = 'Permission Denied';
      transcriptDiv.textContent = 'Opening setup page to fix microphone access...';
      setTimeout(() => {
        chrome.tabs.create({ url: 'options.html' });
      }, 2000);
    } else {
      statusDiv.textContent = 'Error Occurred';
      transcriptDiv.textContent = `System: ${event.error}`;
    }
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
          Actions: 
          - zoom (in/out): amount is the multiplier (default 1).
          - scroll (up/down/top/bottom/next): amount is the multiplier (default 1).
          - volume (up/down): amount is the percentage.
          - tab (next/previous)
          - refresh
          - search (query): Use this if and only if the user says "google [query]" or "search for [query]".
          - other (query): Any other command that doesn't fit the above categories.
          
          Command: "${transcript}"
          Output only valid JSON.`
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'API Request Failed');

    const commandText = data.choices[0].message.content.trim();
    const jsonMatch = commandText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const command = JSON.parse(jsonMatch[0]);
      await executeCommand(command);
    }
  } catch (error) {
    statusDiv.textContent = 'API Error';
    transcriptDiv.textContent = error.message;
  }
}

async function executeCommand(command) {
  if (command.action === 'search') {
    chrome.runtime.sendMessage({ type: 'search', query: command.query });
    statusDiv.textContent = 'Success';
    transcriptDiv.textContent = `Searching Google for: ${command.query}`;
    setTimeout(() => { statusDiv.textContent = 'Ready'; }, 2000);
    return;
  }
  if (command.action === 'other') {
    chrome.runtime.sendMessage({ type: 'other', query: command.query });
    statusDiv.textContent = 'Success';
    transcriptDiv.textContent = `Processing request: ${command.query}`;
    setTimeout(() => { statusDiv.textContent = 'Ready'; }, 2000);
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  chrome.tabs.sendMessage(tab.id, { command }, (response) => {
    if(command.action === 'volume'){
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
      }
    } else {
      statusDiv.textContent = 'Success';
      transcriptDiv.textContent = `Applied: ${command.action}`;
    }
    setTimeout(() => { statusDiv.textContent = 'Ready'; }, 2000);
  });
}