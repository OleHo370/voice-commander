chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'tabControl') {
    handleTabControl(request.direction);
  } else if (request.type === 'zoom') {
    handleZoom(request.direction, request.amount);
  }
  return true; 
});

async function handleTabControl(direction) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (activeTabs.length === 0) return;
  
  const currentIndex = tabs.findIndex(tab => tab.id === activeTabs[0].id);
  let newIndex;
  
  if (direction === 'next') {
    newIndex = (currentIndex + 1) % tabs.length;
  } else {
    newIndex = currentIndex - 1 < 0 ? tabs.length - 1 : currentIndex - 1;
  }
  
  chrome.tabs.update(tabs[newIndex].id, { active: true });
}

async function handleZoom(direction, amount) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) return;
  
  const tabId = tabs[0].id;
  const currentZoom = await chrome.tabs.getZoom(tabId);
  const zoomChange = (amount || 10) / 100;
  
  let newZoom = direction === 'in' ? currentZoom + zoomChange : currentZoom - zoomChange;
  newZoom = Math.max(0.25, Math.min(5, newZoom));
  
  await chrome.tabs.setZoom(tabId, newZoom);
}chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status == 'complete') {
    chrome.tabs.sendMessage(tabId, { action: "changeVolume", mode: 1 });
  }
});
