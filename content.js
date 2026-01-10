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
  }
}