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
      const multiplier = command.amount !== undefined ? command.amount : 1;
      const scrollDistance = window.innerHeight * multiplier;
      handleAdvancedScroll(command.direction, scrollDistance);
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

function handleAdvancedScroll(direction, distance) {
  switch (direction) {
    case 'top':
      window.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    case 'bottom':
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      break;
    case 'up':
      window.scrollBy({ top: -distance, behavior: 'smooth' });
      break;
    case 'down':
      window.scrollBy({ top: distance, behavior: 'smooth' });
      break;
    case 'next':
      scrollToNextSection();
      break;
  }
}

function scrollToNextSection() {
  const selectors = 'section, article, h1, h2, h3, hr';
  const elements = Array.from(document.querySelectorAll(selectors));
  const next = elements.find(el => el.getBoundingClientRect().top > 50);
  if (next) {
    next.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
  }
}