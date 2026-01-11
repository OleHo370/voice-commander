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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('modifypage.js received message:', request);
    
    if (request.type === "changeVolume") {
        changeVolume(request.amount);
        sendResponse({ success: true });
        
    } else if (request.type === "drawCircle") {
        console.log('Drawing circle with coordinates:', request.x, request.y);
        drawCircleOnCanvas(request.x, request.y);
        sendResponse({ success: true });
        
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
    }
    
    return true;
});