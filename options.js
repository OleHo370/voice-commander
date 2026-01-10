const btn = document.getElementById('requestBtn');
const status = document.getElementById('status');

btn.onclick = async () => {
    status.innerText = "Requesting permission...";
    status.style.color = "#2563eb";

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        status.innerText = "Permission Granted! You can now use the extension.";
        status.style.color = "#10b981";
        btn.style.display = "none";

        stream.getTracks().forEach(track => track.stop());
        console.log("Permission successful");
    } catch (err) {
        console.error("Permission error:", err);
        status.innerText = "Error: " + err.message;
        status.style.color = "#ef4444";
        
        if (err.name === 'NotAllowedError') {
            status.innerText = "Permission Denied. Please click the lock icon in the address bar to reset.";
        }
    }
};