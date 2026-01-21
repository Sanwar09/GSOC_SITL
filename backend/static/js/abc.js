import { initAvatar, playAnimation, getCurrentAnimation, changeSceneBackground, resetSceneBackground } from './avatar.js';
import { initUI, createTimerWidget, stopTimerInterval, showMovieModal, renderMathSequence, renderImage, renderComparisonImages, displayCapturedPhoto, showLoadingIndicator, clearOverlays, createTopTextContainer, clearTopText, clearCapturedPhoto } from './ui.js';
import { initCamera, handlePhotoCapture } from './camera.js';
import { initTrivia, openTriviaModal } from './trivia.js';

// --- DOM Elements ---
const chatInput = document.getElementById('chat-input');
const askButton = document.getElementById('ask-btn');
const micButton = document.getElementById('mic-btn');
const stopButton = document.getElementById('stop-btn');
const logoutButton = document.getElementById('logout-btn');
const collapseButton = document.getElementById('collapse-btn');
const chatContainer = document.getElementById('chat-container');


// --- State ---
let mediaRecorder;
let audioChunks = [];
let homeViewer = null;
// ✅ UPDATED: State for Perception Mode and its camera stream
let perceptionInterval;
let isPerceiving = false;
let perceptionStream = null; // This will hold the webcam stream for perception


// --- Home Base Function ---
function showHomeBase() {
    const panoramaContainer = document.getElementById('home-base-panorama');
    if (homeViewer || !panoramaContainer) return;

    panoramaContainer.style.display = 'block';

    homeViewer = pannellum.viewer('home-base-panorama', {
        "type": "equirectangular",
        "panorama": "/static/backgrounds/home.png",
        "autoLoad": true,
        "showControls": false,
        "autoRotate": -2,
        "compass": false,
        "hfov": 110
    });
}


// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    initAvatar();
    initUI(speakText);
    initCamera(speakText);
    initTrivia();
    setupEventListeners();
    setupSpeechRecognition();

    try {
        const response = await fetch('/user/status');
        if (!response.ok) {
            console.error("Failed to fetch user status.");
            return;
        }
        
        const status = await response.json();
        if (status.logged_in) {
            showHomeBase(); 
            if (status.is_new_user) {
                handleNewUserWelcome(status.username);
            } else {
                const welcomeResponse = await fetch('/user/welcome_message');
                if (welcomeResponse.ok) {
                    const welcomeData = await welcomeResponse.json();
                    speakText(welcomeData.spoken_text, true);
                } else {
                    speakText(`Welcome back, ${status.username}! How can I help you?`, true);
                }
            }
        } else {
            console.log("Not logged in. Redirecting to dashboard.");
            window.location.href = '/dashboard';
        }
    } catch (error) {
        console.error("Error during initial user status check:", error);
        speakText("I encountered an issue loading your profile. Please try refreshing.", true);
    }
});

function setupEventListeners() {
    askButton.addEventListener("click", () => {
        const prompt = chatInput.value;
        if (prompt) {
            speechSynthesis.cancel();
            clearOverlays();
            processInput(prompt);
        }
    });
    chatInput.addEventListener("keyup", event => {
        if (event.key === "Enter") askButton.click();
    });

    stopButton.addEventListener("click", () => {
        speechSynthesis.cancel();
        stopTimerInterval();
        if (isPerceiving) {
            stopPerceptionMode(); // Also stop perception mode
        }
        if (document.getElementById("timer-widget")) {
            speakText("Okay, I've cancelled the timer.", true);
        }
        playAnimation("idle");
        resetSceneAndVisuals();
    });

    logoutButton.addEventListener('click', async () => {
        await fetch('/user/logout', { method: 'POST' });
        window.location.href = '/dashboard';
    });

    if(collapseButton && chatContainer) {
        collapseButton.addEventListener('click', () => {
            chatContainer.classList.toggle('collapsed');
        });
    }
}

// --- NEW USER VOICE ENROLLMENT (Unchanged) ---
// (Your existing handleNewUserWelcome and startVoiceEnrollment functions go here)
function handleNewUserWelcome(username) {
    const welcomeText = `Hello ${username}! My name is Avatar. Before we begin, please tell me something about yourself so I can learn to recognize your voice. I will start recording after this message.`;
    
    const utterance = new SpeechSynthesisUtterance(welcomeText);
    
    utterance.onstart = () => {
        playAnimation("talk");
        const topText = createTopTextContainer();
        topText.textContent = `Hello ${username}! Please prepare to speak.`;
        askButton.disabled = true;
        micButton.disabled = true;
    };
    
    utterance.onend = () => {
        if (getCurrentAnimation() === "talk") playAnimation("idle");
        startVoiceEnrollment();
    };
    
    speechSynthesis.speak(utterance);
}

async function startVoiceEnrollment() {
    const topText = createTopTextContainer();
    topText.textContent = "🔴 Recording... Please speak clearly for 8 seconds.";
    speakText("I'm listening now.", false);
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const formData = new FormData();
            formData.append('audio_data', audioBlob);

            topText.textContent = "Processing your voice profile...";
            const response = await fetch('/voice/enroll', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (response.ok) {
                const welcomeResponse = await fetch('/user/welcome_message');
                if (welcomeResponse.ok) {
                    const welcomeData = await welcomeResponse.json();
                    speakText(welcomeData.spoken_text, true);
                }
            } else {
                speakText(`There was an issue: ${data.error}. Please refresh the page to try again.`, true);
            }
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === "recording") {
                mediaRecorder.stop();
                topText.textContent = "Recording finished. Processing...";
            }
        }, 8000);

    } catch (error) {
        console.error("Error during voice enrollment:", error);
        speakText("I couldn't access your microphone. Please enable permissions and refresh the page.", true);
        askButton.disabled = false;
        micButton.disabled = false;
        clearTopText();
    }
}


// --- Core Logic (Unchanged) ---
// (Your existing processInput and callBackendAPI functions go here)
async function processInput(prompt) {
    askButton.disabled = true;
    micButton.disabled = true;
    showLoadingIndicator();
    chatInput.value = "";
    await callBackendAPI(prompt);
}

async function callBackendAPI(prompt) {
    try {
        const response = await fetch("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
        });
        if (response.status === 401) {
            alert("Your session has expired. Please log in again.");
            window.location.href = '/dashboard';
            return;
        }
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        renderVisualOutput(data);

        if (data.spoken_text && data.type !== "animation_command" && data.type !== "describe_object") {
            if (data.type === "math_sequence") {
                speakText(data.spoken_text, false);
            } else {
                speakText(data.spoken_text, true);
            }
        } else {
            askButton.disabled = false;
            micButton.disabled = false;
        }

    } catch (error) {
        console.error(error);
        speakText("Oh no, my brain circuits are tangled!", true);
    }
}


// --- Visual Output Rendering ---
async function renderVisualOutput(data) {
    clearOverlays(); 
    switch (data.type) {
        case "toggle_perception":
            if (isPerceiving) {
                stopPerceptionMode();
                speakText("Okay, I'll stop observing now.", true);
            } else {
                startPerceptionMode(); // The success message is now handled inside this function
            }
            break;

        // (The rest of your cases remain unchanged)
        case "open_camera":
            try {
                const photoResult = await handlePhotoCapture('save');
                displayCapturedPhoto(photoResult.imageDataUrl);
                speakText(`Hey ${photoResult.filename}, this is your image.`, true);
            } catch (error) {
                console.log(error);
                speakText("Okay, maybe next time.", true);
            }
            break;
        case "describe_object":
            speakText("Okay, opening the camera now. Show me the object!", true);
            handlePhotoCapture('describe');
            break;
        case "set_timer":
            createTimerWidget(data.seconds);
            break;
        case "start_trivia_game":
            openTriviaModal();
            break;
        case "animation_command":
            playAnimation(data.animation_name); 
            break;
        case "math_sequence":
            await renderMathSequence(data.elements);
            break;
        case "image_topic":
            renderImage(data.image_url);
            break;
        case "comparison_topic":
            renderComparisonImages(data.entities);
            break;
        case "change_background":
            if (data.image_url) {
                const panoramaContainer = document.getElementById('home-base-panorama');
                if (panoramaContainer) {
                    panoramaContainer.style.display = 'none';
                }
                const topText = createTopTextContainer();
                topText.textContent = "Traveling...";
                await changeSceneBackground(data.image_url);
                clearTopText();
            }
            break;
        case "play_movie":
            if (data.movie_url) {
                showMovieModal(data.movie_title, data.movie_url);
            }
            break;
    }
}

// (Your existing resetSceneAndVisuals function goes here)
function resetSceneAndVisuals() {
    clearOverlays();
    resetSceneBackground();
    
    const panoramaContainer = document.getElementById('home-base-panorama');
    if (panoramaContainer) {
        panoramaContainer.style.display = 'block';
    }

    askButton.disabled = false;
    micButton.disabled = false;
}


// --- ✅ NEW SELF-CONTAINED PERCEPTION MODE ---

/**
 * Turns on the webcam and streams it to the dedicated perception <video> element.
 * This is now handled entirely within main.js.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function activatePerceptionCamera() {
    const videoEl = document.getElementById('camera-video');
    if (!videoEl) {
        console.error("The <video id='camera-video'> element is missing from your HTML.");
        return false;
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            // Stop any previous stream before starting a new one
            if (perceptionStream) {
                perceptionStream.getTracks().forEach(track => track.stop());
            }
            perceptionStream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoEl.srcObject = perceptionStream;
            await videoEl.play();
            videoEl.classList.remove('hidden');
            console.log("✅ Perception camera activated directly from main.js.");
            return true;
        } catch (err) {
            console.error("Error accessing webcam for perception:", err);
            alert("Could not access the camera for Perception Mode. Please grant permission.");
            return false;
        }
    }
    return false; // Fallback if getUserMedia is not supported
}

/**
 * Turns off the webcam stream for perception mode.
 */
function deactivatePerceptionCamera() {
    const videoEl = document.getElementById('camera-video');
    if (perceptionStream) {
        perceptionStream.getTracks().forEach(track => track.stop());
        perceptionStream = null;
    }
    if (videoEl) {
        videoEl.classList.add('hidden');
    }
    console.log("🛑 Perception camera deactivated.");
}


/**
 * Gets a single, silent frame from the active perception camera stream.
 */
async function getSilentCameraFrame() {
    return new Promise((resolve, reject) => {
        const videoElement = document.getElementById('camera-video');
        if (!videoElement || videoElement.readyState < 2) {
            reject(new Error("Perception camera is not ready."));
            return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg'));
    });
}

/**
 * Starts the perception loop and activates the camera.
 */
async function startPerceptionMode() {
    if (isPerceiving) return;

    const cameraStarted = await activatePerceptionCamera();
    if (!cameraStarted) {
        speakText("I can't start watching without camera access.", true);
        return;
    }

    isPerceiving = true;
    speakText("Perception mode activated. I'll let you know if I see anything interesting.", true);
    console.log("👁️ Starting perception mode...");

    analyzeScene(); 
    perceptionInterval = setInterval(analyzeScene, 15000);
}

/**
 * Stops the perception loop and deactivates the camera.
 */
function stopPerceptionMode() {
    if (!isPerceiving) return;
    clearInterval(perceptionInterval);
    isPerceiving = false;
    deactivatePerceptionCamera();
    console.log("🛑 Stopping perception mode.");
}

/**
 * The core logic for a single perception check.
 */
async function analyzeScene() {
    console.log("🔬 Analyzing current scene...");
    try {
        const frame = await getSilentCameraFrame();
        
        const res = await fetch('/analyze-environment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_data: frame }),
        });

        if (!res.ok) {
            console.error("Failed to analyze environment, server responded with:", res.status);
            return;
        }

        const data = await res.json();
        
        if (data.speak) {
            console.log("📢 Perception found something to say:", data.text);
            if (!speechSynthesis.speaking) {
                speakText(data.text, true);
            } else {
                console.log("...but speech is already in progress. Skipping observation.");
            }
        } else {
            console.log("...scene unchanged.");
        }
    } catch (error) {
        console.error("Error in perception loop:", error);
        speakText("There was an issue with my vision, I'm stopping perception mode.", true);
        stopPerceptionMode();
    }
}


// --- Speech Synthesis & Recognition (Unchanged) ---
// (Your existing speakText and setupSpeechRecognition functions go here)
function speakText(text, showCaptions) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    utterance.onstart = () => {
        playAnimation("talk");
    };

    const onSpeechEnd = () => {
        if (getCurrentAnimation() === "talk") playAnimation("idle");
        askButton.disabled = false;
        micButton.disabled = false;
        clearCapturedPhoto();
        setTimeout(() => {
            clearOverlays();
        }, 3000);
    };

    if (showCaptions) {
        const topText = createTopTextContainer();
        topText.innerHTML = "";
        const words = text.split(/\s+/);
        const wordSpans = words.map(word => {
            const span = document.createElement("span");
            span.className = "caption-word";
            span.textContent = word;
            topText.appendChild(span);
            return span;
        });
        
        let wordIndex = 0;
        utterance.onboundary = event => {
            if (event.name === "word") {
                if (wordSpans[wordIndex]) {
                    wordSpans[wordIndex].classList.add("visible");
                    wordIndex++;
                }
            }
        };

        utterance.onend = () => {
            onSpeechEnd();
            setTimeout(() => {
                if (topText) topText.innerHTML = '';
            }, 1500);
        };
    } else {
        utterance.onend = onSpeechEnd;
    }
    
    speechSynthesis.speak(utterance);
}

function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = "en-US";
        recognition.interimResults = false;
        micButton.addEventListener("click", () => {
            speechSynthesis.cancel();
            clearOverlays();
            chatInput.value = "";
            recognition.start();
        });
        recognition.onstart = () => micButton.classList.add("listening");
        recognition.onend = () => micButton.classList.remove("listening");
        recognition.onresult = event => {
            const transcript = event.results[event.results.length - 1][0].transcript.trim();
            chatInput.value = transcript;
            processInput(transcript);
        };
        recognition.onerror = event => {
            console.error("Speech recognition error:", event.error);
            micButton.classList.remove("listening");
            if (event.error !== 'no-speech') {
                speakText("I had trouble with my ears. Please try again.", true);
            }
        };
    } else {
        micButton.style.display = "none";
        console.warn("Speech Recognition API not supported in this browser.");
    }
}