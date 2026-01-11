function getAudioElements(){
    return [
        ...document.querySelectorAll("video"),
        ...document.querySelectorAll("audio")
    ];
}

function changeVolume(amount){ 
    getAudioElements().forEach(el => {
        el.volume = Math.min(Math.max(el.volume + amount * 0.1, 0), 1);
    })
}

function drawCircleOnCanvas(normX, normY) {
    console.log('drawCircleOnCanvas called with:', normX, normY);
    
    const oldCanvas = document.getElementById('voice-commander-canvas');
    if (oldCanvas) oldCanvas.remove();

    const canvas = document.createElement('canvas');
    canvas.id = 'voice-commander-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '2147483647';
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const realX = (normX / 1000) * window.innerWidth;
    const realY = (normY / 1000) * window.innerHeight;

    console.log('Drawing circle at screen position:', realX, realY);

    let radius = 20;
    let opacity = 1;

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.beginPath();
        ctx.arc(realX, realY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${opacity})`;
        ctx.lineWidth = 8;
        ctx.stroke();
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = "red";

        radius += 0.4;
        opacity -= 0.005;

        if (opacity > 0) {
            requestAnimationFrame(animate);
        } else {
            canvas.remove();
        }
    }
    animate();
}

function clickAtExactPoint(point) {
    if (!point || !Array.isArray(point) || point.length !== 2) {
        console.error('Invalid point coordinates:', point);
        return false;
    }
    
    try {
        const x = (point[1] / 1000) * window.innerWidth;
        const y = (point[0] / 1000) * window.innerHeight;
        
        console.log('Clicking at EXACT coordinates - X:', x, 'Y:', y);
        console.log('Normalized coordinates:', point);

        const element = document.elementFromPoint(x, y);
        
        if (element) {
            console.log('Element at exact position:', element.tagName, element.className);
            console.log('Element text:', element.textContent.substring(0, 100));
            
            const clickableParent = element.closest('a, button, [role="button"], [onclick]');
            
            if (clickableParent) {
                console.log('Found clickable parent:', clickableParent.tagName, clickableParent.href || clickableParent.className);
                clickableParent.click();
                return true;
            } else {

                console.log('No clickable parent, clicking element directly');
                element.click();
                return true;
            }
        } else {
            console.error('No element found at coordinates');
            return false;
        }
    } catch (error) {
        console.error('Error clicking at coordinates:', error);
        return false;
    }
}

function clickByText(query) {
    if (!query) {
        console.log('No query provided for text search');
        return false;
    }
    
    console.log('Searching for clickable elements by text:', query);
    const allLinks = document.querySelectorAll('a, button, [role="button"], input[type="submit"], input[type="button"], [onclick]');
    const queryLower = query.toLowerCase();
    
    console.log('Searching through', allLinks.length, 'potential clickable elements');
    
    for (const link of allLinks) {
        const text = link.textContent.trim().toLowerCase();
        const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
        const title = (link.getAttribute('title') || '').toLowerCase();
        const value = (link.getAttribute('value') || '').toLowerCase();
        
        if (text === queryLower || ariaLabel === queryLower || title === queryLower || value === queryLower ||
            text.includes(queryLower) || ariaLabel.includes(queryLower) || title.includes(queryLower)) {
            console.log('Found and clicking element by text (exact/contains):', link.tagName, text.substring(0, 50));
            link.click();
            return true;
        }
    }

    for (const link of allLinks) {
        const text = link.textContent.trim().toLowerCase();
        if (text.length > 0 && queryLower.includes(text)) {
            console.log('Found and clicking element by text (partial match):', link.tagName, text.substring(0, 50));
            link.click();
            return true;
        }
    }
    
    console.log('No element found by text search');
    return false;
}

function clickLinkAtPosition(query, point, useTextSearch) {
    try {
        console.log('clickLinkAtPosition called with query:', query, 'useTextSearch:', useTextSearch);
        

        if (useTextSearch || !point) {
            return clickByText(query);
        }
        
        if (point && Array.isArray(point) && point.length === 2) {

            const realX = (point[1] / 1000) * window.innerWidth;
            const realY = (point[0] / 1000) * window.innerHeight;
            

            const adjustedX = realX - 10;
            const adjustedY = realY + 10;
            
            console.log('Converted coordinates - X (adjusted):', adjustedX, '(original X:', realX + '), Y (adjusted):', adjustedY, '(original Y:', realY + ')');
            
            const element = document.elementFromPoint(adjustedX, adjustedY);
            
            if (element) {
                console.log('Element found at position:', element.tagName, element.className, element.id);
                
                let clickable = element.closest('a, button, [onclick], [role="button"], input[type="submit"], input[type="button"], [tabindex]');
                
                if (!clickable) {
                    if (element.tagName === 'A' || element.tagName === 'BUTTON' || 
                        (element.tagName === 'INPUT' && (element.type === 'submit' || element.type === 'button')) ||
                        element.onclick || element.hasAttribute('onclick')) {
                        clickable = element;
                    }
                }
                
                if (clickable) {
                    console.log('Found clickable element:', clickable.tagName, clickable.className);
                    clickable.click();
                    return true;
                } else {
                    console.log('No explicit clickable found, trying element directly');
                    element.click();
                    return true;
                }
            }
        }
        
        return clickByText(query);
        
    } catch (error) {
        console.error('Error clicking link:', error);
        return false;
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('modifypage.js received message:', request);
    
    if (request.type === "changeVolume") {
        changeVolume(request.amount);
        sendResponse({ success: true });
        return true;
        
    } else if (request.type === "drawCircle") {
        console.log('Drawing circle with coordinates:', request.x, request.y);
        drawCircleOnCanvas(request.x, request.y);
        sendResponse({ success: true });
        return true;
        
    } else if (request.type === "clickAtCoordinates") {
        console.log('Clicking at exact coordinates:', request.point);
        const clicked = clickAtExactPoint(request.point);
        sendResponse({ success: clicked });
        return true;
        
    } else if (request.type === "clickLink") {
        console.log('Attempting to click link:', request.query, 'useTextSearch:', request.useTextSearch);
        const clicked = clickLinkAtPosition(request.query, request.point, request.useTextSearch);
        sendResponse({ success: clicked });
        return true;
        
    } else if (request.command) {
        if (request.command.action === 'scroll') {
            const dist = window.innerHeight * (request.command.amount || 1);
            if (request.command.direction === 'top') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (request.command.direction === 'bottom') {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            } else if (request.command.direction === 'up') {
                window.scrollBy({ top: -dist, behavior: 'smooth' });
            } else {
                window.scrollBy({ top: dist, behavior: 'smooth' });
            }
        } else if (request.command.action === 'refresh') {
            location.reload();
        }
        sendResponse({ success: true });
        return true;
    }
    
    return false;
});

function clickLinkAtPosition(query, point) {
    try {
        console.log('clickLinkAtPosition called with query:', query, 'point:', point);
        
        if (point && Array.isArray(point) && point.length === 2) {
            const viewportX = (point[1] / 1000) * window.innerWidth;
            const viewportY = (point[0] / 1000) * window.innerHeight;
            
            console.log('Converted coordinates - viewport X:', viewportX, 'viewport Y:', viewportY);
            console.log('Window dimensions - width:', window.innerWidth, 'height:', window.innerHeight);

            const element = document.elementFromPoint(viewportX, viewportY);
            
            if (element) {
                console.log('Element found at position:', element.tagName, element.className, element.id);
                console.log('Element text content:', element.textContent.substring(0, 100));
                
                let clickable = element.closest('a, button, [onclick], [role="button"], input[type="submit"], input[type="button"], [tabindex]');

                if (!clickable) {
                    if (element.tagName === 'A' || element.tagName === 'BUTTON' || 
                        (element.tagName === 'INPUT' && (element.type === 'submit' || element.type === 'button')) ||
                        element.onclick || element.hasAttribute('onclick')) {
                        clickable = element;
                    }
                }
                
                if (clickable) {
                    console.log('Found clickable element:', clickable.tagName, clickable.className);
                    console.log('Clickable element text:', clickable.textContent.substring(0, 100));
                    clickable.click();
                    return true;
                } else {
                    console.log('No explicit clickable found, trying to click element directly');
                    element.click();
                    return true;
                }
            } else {
                console.log('No element found at position');
            }
        }
        
        if (query) {
            console.log('Falling back to text search for:', query);
            const allLinks = document.querySelectorAll('a, button, [role="button"], input[type="submit"], input[type="button"]');
            const queryLower = query.toLowerCase();
            
            console.log('Searching through', allLinks.length, 'potential clickable elements');
            
            for (const link of allLinks) {
                const text = link.textContent.trim().toLowerCase();
                const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
                const title = (link.getAttribute('title') || '').toLowerCase();
                
                if (text.includes(queryLower) || queryLower.includes(text) || 
                    ariaLabel.includes(queryLower) || title.includes(queryLower)) {
                    console.log('Found and clicking element by text:', link.tagName, text.substring(0, 50));
                    link.click();
                    return true;
                }
            }
            console.log('No element found by text search');
        }
        
        return false;
    } catch (error) {
        console.error('Error clicking link:', error);
        return false;
    }
}