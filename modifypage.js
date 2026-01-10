function getAudioElements(){
    return [
        ...document.querySelectorAll("video"),
        ...document.querySelectorAll("audio")
    ];
}

function changeVolume(mode){ //positive values of mode increase volume, negative decrease. (10 corresponds to 100% increase)
    getAudioElements().forEach(el => {
        console.log("Mode: " + mode + " Current Volume: " + el.volume);
        el.volume = Math.min(Math.max(el.volume + mode * 0.5, 0), 1); // Adjust volume by 10%
        console.log("New Volume: " + el.volume);
    })
}

//Get requests from background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "changeVolume") {
        changeVolume(request.mode);
    }
});