let OPENROUTER_API_KEY = null;
let ELEVENLABS_API_KEY = null;
const VOICE_ID = 'TX3LPaxmHKxFdv7VOQHJ'; // Example voice ID, replace with your desired voice ID

chrome.storage.sync.get(['openrouterApiKey'], (result) => {
  OPENROUTER_API_KEY = result.openrouterApiKey;
  
  if (!OPENROUTER_API_KEY) {
    console.log('Configuration Error');
    console.log('API key not found. Please set it in the extension options.');
    micButton.disabled = true;
  }
});

chrome.storage.sync.get(['elevenlabsApiKey'], (result) => {
  ELEVENLABS_API_KEY = result.elevenlabsApiKey;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'tabControl') {
    handleTabControl(request.direction);
  } else if (request.type === 'zoom') {
    handleZoom(request.direction, request.amount);
  } else if (request.type === 'search') {
    handleSearch(request.query);
  } else if (request.type === 'other') {
    console.log("Handling 'other' request: ", request.query);
    processRequest(request.query);
    // Here you can add additional handling for 'other' commands if needed
  }
  return true; 
});

function handleSearch(query) {
  if (!query) return;
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  chrome.tabs.create({ url });
}

async function handleTabControl(direction) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTabs.length === 0) return;
  
  const currentIndex = tabs.findIndex(tab => tab.id === activeTabs[0].id);
  let newIndex = direction === 'next' 
    ? (currentIndex + 1) % tabs.length 
    : (currentIndex - 1 + tabs.length) % tabs.length;
  
  chrome.tabs.update(tabs[newIndex].id, { active: true });
}

async function handleZoom(direction, amount) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) return;
  
  const tabId = tabs[0].id;
  const currentZoom = await chrome.tabs.getZoom(tabId);
  
  const multiplier = amount !== undefined ? amount : 1;
  const zoomChange = multiplier * 0.3;
  
  let newZoom = direction === 'in' 
    ? currentZoom + zoomChange 
    : currentZoom - zoomChange;
    
  newZoom = Math.max(0.25, Math.min(5, newZoom));
  await chrome.tabs.setZoom(tabId, newZoom);
}chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status == 'complete') {
    //chrome.tabs.sendMessage(tabId, { action: "changeVolume", amount: 1 });
  }
});

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
          Respond to the user's quesitions in a simple, friendly, and concise manner, avoiding technical jargon. Keep it within 10 seconds.
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
    console.log("Response: " + responseText);

    await generateSpeech(responseText);
    
  } catch (error) {
    console.log('Error processing request:', error);
  }
}

async function generateSpeech(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2', // Use the V2 model for quality
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("Creating offscreen document...");
    await createOffscreenDocument();
    console.log("Offscreen document created. Creating buffer...");

    const audioBuffer = await response.arrayBuffer();

    // convert ArrayBuffer to base64 for message passing
    function arrayBufferToBase64(buffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }

    const audioBase64 = arrayBufferToBase64(audioBuffer);

    console.log("Sending audio to offscreen document...");
    await chrome.runtime.sendMessage({ type: "playAudio", audioBase64, mimeType: 'audio/mpeg' });

  } catch (error) {
    console.error('Error generating speech:', error);
  }
}

async function createOffscreenDocument() {
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({
      url: "html/offscreen.html",
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "play sound effects for notification"
    });
  }
}