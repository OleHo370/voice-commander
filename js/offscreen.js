console.log('Offscreen document loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Offscreen received message:', request.type);
  
  if (request.type === 'playAudio' && request.audioBase64) {
    try {
      console.log('Playing audio, base64 length:', request.audioBase64.length);
      
      const byteCharacters = atob(request.audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: request.mimeType || 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      
      let audio = document.getElementById('offscreen-audio');
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = 'offscreen-audio';
        audio.style.display = 'none';
        document.body.appendChild(audio);
      }
      
      audio.src = url;
      audio.volume = 1.0;
      
      audio.play().then(() => {
        console.log('Audio playing successfully');
        if (sendResponse) sendResponse({ status: 'playing' });
      }).catch(err => {
        console.error('Offscreen audio play failed:', err);
        if (sendResponse) sendResponse({ status: 'error', error: String(err) });
      });
      
      return true;
    } catch (e) {
      console.error('Offscreen playAudio handling error:', e);
      if (sendResponse) sendResponse({ status: 'error', error: String(e) });
    }
  }
});