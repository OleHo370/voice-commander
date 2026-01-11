let OPENROUTER_API_KEY = null;
let ELEVENLABS_API_KEY = null;
let VOICE_ID = null;

async function loadAPIKeys() {
  chrome.storage.sync.get(['openrouterApiKey', 'elevenlabsApiKey'], (result) => {
    OPENROUTER_API_KEY = result.openrouterApiKey;
    ELEVENLABS_API_KEY = result.elevenlabsApiKey;
    console.log('API Keys loaded:', { 
      openrouter: !!OPENROUTER_API_KEY, 
      elevenlabs: !!ELEVENLABS_API_KEY 
    });
  });
chrome.storage.local.get(['selectedVoice'], (result) => {
  VOICE_ID = result.selectedVoice;
  console.log('Selected voice ID loaded:', VOICE_ID);
});
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'tabControl') {
    handleTabControl(request.direction);
  } else if (request.type === 'zoom') {
    handleZoom(request.direction, request.amount);
  } else if (request.type === 'search') {
    handleSearch(request.query);
  } else if (request.type === 'other') {
    processVisualRequest(request.query, request.image, request.tabId);
    return true; 
  }
  return true;
});

async function processVisualRequest(query, imageData, tabId) {
  console.log('Processing visual request:', query);
  
  if (!OPENROUTER_API_KEY) {
    await loadAPIKeys();
  }

  try {
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
              text: `You are an AI assistant helping a user. Answer their question briefly and friendly based on the screenshot. Question: "${query}"` 
            },
            { type: 'image_url', image_url: { url: imageData } }
          ]
        }]
      })
    });

    const data = await response.json();
    console.log('API Response:', data);
    
    if (data.choices && data.choices[0]) {
      const answer = data.choices[0].message.content.trim();
      console.log('Generated answer:', answer);
      await generateSpeech(answer);
    } else {
      console.error('Unexpected API response format:', data);
    }
  } catch (error) {
    console.error('API Error:', error);
  }
}

async function generateSpeech(text) {
  if (!ELEVENLABS_API_KEY) {
    console.error('ElevenLabs API key not found');
    return;
  }

  console.log('Generating speech for:', text);
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
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.5 }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      return;
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = arrayBufferToBase64(audioBuffer);
    
    console.log('Audio generated, creating offscreen document');
    await createOffscreenDocument();

    setTimeout(() => {
      chrome.runtime.sendMessage({ 
        type: "playAudio", 
        audioBase64: audioBase64, 
        mimeType: 'audio/mpeg' 
      });
      console.log('Audio message sent to offscreen');
    }, 300);
  } catch (error) { 
    console.error('Speech generation error:', error); 
  }
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function createOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL("html/offscreen.html");
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });
  
  if (contexts.length > 0) {
    console.log('Offscreen document already exists');
    return;
  }
  
  console.log('Creating offscreen document');
  await chrome.offscreen.createDocument({
    url: "html/offscreen.html",
    reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: "Voice response"
  });
}

function handleSearch(query) {
  chrome.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
}

async function handleTabControl(direction) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTabs.length === 0) return;
  const currentIndex = tabs.findIndex(tab => tab.id === activeTabs[0].id);
  let newIndex = direction === 'next' ? (currentIndex + 1) % tabs.length : (currentIndex - 1 + tabs.length) % tabs.length;
  chrome.tabs.update(tabs[newIndex].id, { active: true });
}

async function handleZoom(direction, amount) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) return;
  const currentZoom = await chrome.tabs.getZoom(tabs[0].id);
  const zoomChange = (amount || 1) * 0.3;
  let newZoom = direction === 'in' ? currentZoom + zoomChange : currentZoom - zoomChange;
  await chrome.tabs.setZoom(tabs[0].id, Math.max(0.25, Math.min(5, newZoom)));
}

loadAPIKeys();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CAPTURE_SCREENSHOT") {
    chrome.tabs.captureVisibleTab(
      null,
      { format: "jpeg", quality: 40 },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ dataUrl });
        }
      }
    );
    return true; // async response
  }
});