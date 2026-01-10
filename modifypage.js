function getAudioElements(){
    return [
        ...document.querySelectorAll("video"),
        ...document.querySelectorAll("audio")
    ];
}

function changeVolume(amount){ //positive values of mode increase volume, negative decrease. (10 corresponds to 100% increase)
    getAudioElements().forEach(el => {
        console.log("Amount: " + amount + " Current Volume: " + el.volume);
        el.volume = Math.min(Math.max(el.volume + amount * 0.1, 0), 1);
        console.log("New Volume: " + el.volume);
    })
}

//Get requests from background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("The type is: " + request.type);
    if (request.type === "changeVolume") {
        console.log("Im changing da volume by " + request.amount);
        changeVolume(request.amount);
        sendResponse({ success: true });
    }
});