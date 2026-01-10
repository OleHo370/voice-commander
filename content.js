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
      const videos = document.querySelectorAll('video, audio');
      const volAmt = (command.amount || 10) / 100;
      videos.forEach(media => {
        media.volume = command.direction === 'up' 
          ? Math.min(1, media.volume + volAmt) 
          : Math.max(0, media.volume - volAmt);
      });
      break;
    case 'refresh':
      location.reload();
      break;
  }
}