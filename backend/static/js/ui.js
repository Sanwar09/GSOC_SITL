// --- DOM Elements ---
const visualOutputContainer = document.getElementById("visual-output-container");
const movieModalOverlay = document.getElementById('movie-modal-overlay');
const movieIframe = document.getElementById('movie-iframe');
const movieTitleDisplay = document.getElementById('movie-title-display');
const closeMovieBtn = document.getElementById('close-movie-btn');

let speakTextCallback; // To hold the speakText function from main.js

export function initUI(speakTextFunc) {
    speakTextCallback = speakTextFunc;
    if(closeMovieBtn) closeMovieBtn.addEventListener('click', closeMovieModal);
}

// --- Movie Modal ---
function closeMovieModal() {
    movieModalOverlay.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => {
        movieModalOverlay.classList.add('hidden');
    }, 300);
    movieIframe.src = "";
    speakTextCallback("Hope you enjoyed!!!", true);
}

export function showMovieModal(title, url) {
    clearOverlays();
    movieTitleDisplay.textContent = `Now Playing: ${title}`;
    movieIframe.src = url;
    movieModalOverlay.classList.remove('hidden');

    // --- ADD THESE 2 LINES ---
    movieModalOverlay.style.pointerEvents = "auto"; 
    movieModalOverlay.style.zIndex = "10001"; 
    // -------------------------

    setTimeout(() => {
        movieModalOverlay.classList.remove('opacity-0', 'pointer-events-none');
    }, 10);
}
// --- Timer Widget ---
let timerInterval, timeRemainingInSeconds, isTimerPaused = true, initialSeconds = 0;

export function createTimerWidget(seconds) {
    const existingWidget = document.getElementById("timer-widget");
    if (existingWidget) {
        existingWidget.remove();
    }

    initialSeconds = seconds;
    timeRemainingInSeconds = seconds;
    isTimerPaused = true;
    if (isNaN(timeRemainingInSeconds)) timeRemainingInSeconds = 0;

    const widget = document.createElement("div");
    widget.id = "timer-widget";
    widget.style.pointerEvents = "auto";
    widget.style.zIndex = "10001";
    widget.innerHTML = `
        <button id="timer-close-btn" style="position: absolute; top: 8px; right: 12px; font-size: 24px; border: none; background: transparent; color: #aaa; cursor: pointer; line-height: 1;">&times;</button>
        <div id="timer-display"></div>
        <div id="timer-controls">
            <button id="timer-start-pause" class="timer-btn start">Start</button>
            <button id="timer-reset" class="timer-btn reset">Reset</button>
            <button id="timer-edit" class="timer-btn edit">Edit</button>
        </div>`;
    visualOutputContainer.appendChild(widget);
    updateTimerDisplay();
    document.getElementById("timer-start-pause").onclick = toggleTimer;
    document.getElementById("timer-reset").onclick = resetTimer;
    document.getElementById("timer-edit").onclick = editTimer;
    document.getElementById("timer-close-btn").onclick = closeTimerWidget;
}

function closeTimerWidget() {
    stopTimerInterval();
    const widget = document.getElementById("timer-widget");
    if (widget) {
        widget.remove();
    }
    speakTextCallback("Okay, I've cancelled the timer.", true);
}

function updateTimerDisplay() {
    const display = document.getElementById("timer-display");
    if (display) {
        const minutes = Math.floor(timeRemainingInSeconds / 60);
        const seconds = timeRemainingInSeconds % 60;
        display.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
}

function toggleTimer() {
    isTimerPaused = !isTimerPaused;
    if (timeRemainingInSeconds <= 0) return;
    const button = document.getElementById("timer-start-pause");
    if (isTimerPaused) {
        button.textContent = "Start";
        button.className = "timer-btn start";
        clearInterval(timerInterval);
    } else {
        button.textContent = "Pause";
        button.className = "timer-btn pause";
        timerInterval = setInterval(tick, 1000);
    }
}

function tick() {
    timeRemainingInSeconds--;
    updateTimerDisplay();
    if (timeRemainingInSeconds <= 0) {
        clearInterval(timerInterval);
        const alarm = document.getElementById("timer-alarm");
        if(alarm) alarm.play();
        setTimeout(() => {
            closeTimerWidget();
            speakTextCallback("Time's up! Your timer has finished.", true);
        }, 1000);
    }
}

function resetTimer() {
    clearInterval(timerInterval);
    isTimerPaused = true;
    createTimerWidget(initialSeconds);
}

function editTimer() {
    clearInterval(timerInterval);
    isTimerPaused = true;
    const newTime = prompt(`Enter new time (e.g., '5m' for minutes or '30s' for seconds):`, `${Math.floor(initialSeconds / 60)}m`);
    
    if (newTime) {
        let seconds = 0;
        if (newTime.toLowerCase().includes("m")) seconds = parseInt(newTime, 10) * 60;
        else if (newTime.toLowerCase().includes("s")) seconds = parseInt(newTime, 10);
        else if (!isNaN(parseInt(newTime, 10))) seconds = parseInt(newTime, 10) * 60;
        createTimerWidget(seconds > 0 ? seconds : initialSeconds);
    } else {
        createTimerWidget(timeRemainingInSeconds);
    }
}

export function stopTimerInterval() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
}

// --- Other Visuals ---
export async function renderMathSequence(elements) {
    const container = document.createElement("div");
    container.className = "math-container";
    visualOutputContainer.appendChild(container);

    for (const el of elements) {
        const span = document.createElement("span");
        span.className = "math-element";
        span.textContent = el;
        container.appendChild(span);
        await new Promise(res => setTimeout(res, 50));
        span.classList.add("visible");
        await new Promise(res => setTimeout(res, 600));
    }

    setTimeout(() => {
        container.style.transition = 'opacity 0.5s ease';
        container.style.opacity = '0';
        setTimeout(() => {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        }, 500);
    }, 3000);
}

export function renderImage(imageUrl) {
    const container = document.createElement("div");
    container.className = "image-topic-container";
    const imgElement = document.createElement("img");
    imgElement.src = imageUrl;
    container.appendChild(imgElement);
    visualOutputContainer.appendChild(container);
    setTimeout(() => container.classList.add("visible"), 100);
}

export function renderComparisonImages(entities) {
    const leftContainer = document.createElement("div");
    leftContainer.className = "comparison-image-container left";
    const leftImg = document.createElement("img");
    leftImg.src = entities[0].image_url;
    leftContainer.appendChild(leftImg);
    visualOutputContainer.appendChild(leftContainer);

    if (entities.length > 1) {
        const rightContainer = document.createElement("div");
        rightContainer.className = "comparison-image-container right";
        const rightImg = document.createElement("img");
        rightImg.src = entities[1].image_url;
        rightContainer.appendChild(rightImg);
        visualOutputContainer.appendChild(rightContainer);
    }
    setTimeout(() => {
        leftContainer.classList.add("visible");
        visualOutputContainer.querySelector(".right")?.classList.add("visible");
    }, 50);
}

export function displayCapturedPhoto(imageDataUrl) {
    const existingPhoto = document.getElementById("captured-photo-container");
    if (existingPhoto) existingPhoto.remove();

    const container = document.createElement("div");
    container.id = "captured-photo-container";
    const imgElement = document.createElement("img");
    imgElement.src = imageDataUrl;
    container.appendChild(imgElement);
    visualOutputContainer.appendChild(container);
    
    setTimeout(() => container.classList.add("visible"), 100);
    // NOTE: The removal logic is now handled by main.js after speech ends.
}

export function clearCapturedPhoto() {
    const photoContainer = document.getElementById("captured-photo-container");
    if (photoContainer) {
        photoContainer.style.transition = 'opacity 0.5s ease';
        photoContainer.style.opacity = '0';
        setTimeout(() => {
            if (photoContainer.parentNode) {
                photoContainer.parentNode.removeChild(photoContainer);
            }
        }, 500);
    }
}

export function createTopTextContainer() {
    let container = document.getElementById("top-text-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "top-text-container";
        visualOutputContainer.appendChild(container);
    }
    return container;
}

export function clearTopText() {
    const topText = document.getElementById("top-text-container");
    if (topText) {
        topText.innerHTML = "";
    }
}

export function showLoadingIndicator() {
    clearOverlays();
    const topText = createTopTextContainer();
    topText.textContent = "Thinking... 🤔";
}

export function clearOverlays() {
    visualOutputContainer.innerHTML = "";
}