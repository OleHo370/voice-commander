// Offscreen script: listens for playAudio messages and plays audio
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'playAudio' && request.audioBase64) {
    try {
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
        sendResponse({ status: 'playing' });
      }).catch(err => {
        console.error('Offscreen audio play failed:', err);
        sendResponse({ status: 'error', error: String(err) });
      });

      // keep message channel open for sendResponse
      return true;
    } catch (e) {
      console.error('Offscreen playAudio handling error:', e);
      sendResponse({ status: 'error', error: String(e) });
    }
  }
});
