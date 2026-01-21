import { initAvatar, playAnimation, getCurrentAnimation, changeSceneBackground, resetSceneBackground } from './avatar.js';
import { initUI, createTimerWidget, stopTimerInterval, showMovieModal, renderMathSequence, renderImage, displayCapturedPhoto, showLoadingIndicator, clearOverlays, createTopTextContainer, clearTopText, clearCapturedPhoto } from './ui.js';
import { initCamera, handlePhotoCapture, captureFaceForRegistration } from './camera.js';
import { initTrivia, openTriviaModal } from './trivia.js';
import { createHologram, clearHologram } from './hologram.js';

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
let perceptionInterval;
let perceptionTimeout = null; // New timeout variable for robust loop
let isPerceiving = false;
let perceptionStream = null;
let isRecordingQuery = false; // Track if we are currently recording a voice query

// --- Home Base Function (DISABLED FOR TRANSPARENCY) ---
function showHomeBase() {
    // Disabled to allow transparency
    const panoramaContainer = document.getElementById('home-base-panorama');
    if (panoramaContainer) {
        panoramaContainer.style.display = 'none';
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Initializing ONI System...");
    try {
        initAvatar();
        initUI(speakText);
        initCamera(speakText);
        initTrivia();
        
        // 🚀 ACTIVATE HEARTBEAT (Step 8)
        startHeartbeat(); 
        
        setupEventListeners();
        setupSpeechToTextPython(); 

        const response = await fetch('/user/status');
        if (!response.ok) {
            console.error("Failed to fetch user status.");
            return;
        }
        
        const status = await response.json();
        if (status.logged_in) {
            resetSceneBackground(); // Make sure it's transparent
            clearOverlays();
            if (status.is_new_user) {
                handleNewUserWelcome(status.username);
            } else {
                const welcomeResponse = await fetch('/user/welcome_message');
                if (welcomeResponse.ok) {
                    const welcomeData = await welcomeResponse.json();
                    speakText(welcomeData.spoken_text, true);
                } else {
                    speakText(`Welcome back, ${status.username}!`, true);
                }
            }
        } else {
            console.log("Not logged in. Redirecting to dashboard.");
            window.location.href = '/dashboard';
        }
    } catch (error) {
        console.error("Error during initialization:", error);
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
        clearHologram();
        
        // --- FIX: Ensure comparison is removed on stop ---
        removeComparisonContainer(); 
        
        if (isPerceiving) {
            stopPerceptionMode();
        }
        removeHUD(); // Clear the HUD
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

// --- HELPER: FORMAT TEXT (Remove ** and make bold) ---
function formatTextForHTML(text) {
    if (!text) return "";
    // Replace **text** with <strong style="color: #00f3ff;">text</strong>
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #00f3ff;">$1</strong>');
    // Replace newlines with <br>
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
}

function cleanTextForSpeech(text) {
    if (!text) return "";
    // Remove ** asterisks completely for speech
    return text.replace(/\*\*/g, '');
}

// --- NEW INTERACTIVE HUD FUNCTION ---
function showHUD(screenData) {
    removeHUD(); 
    let hasSpokenDetailed = false; // State to track if we already read the details

    // 1. Create Scan Effect
    const scanLine = document.createElement('div');
    scanLine.className = 'scan-line';
    document.body.appendChild(scanLine);
    setTimeout(() => scanLine.remove(), 2000); // Remove after animation

    // 2. Create Interactive Card after delay
    setTimeout(() => {
        const card = document.createElement('div');
        card.className = 'hud-card';
        card.id = 'active-hud-card';
        
        // Initial View (Short)
        const initialContent = `
            <div class="hud-header">
                <div class="hud-title">TARGET: ${screenData.app_name || 'UNKNOWN'}</div>
                <div class="hud-status">${screenData.status || 'ACTIVE'}</div>
            </div>
            <div class="hud-content" id="hud-text-area">
                ${formatTextForHTML(screenData.short_summary)}
            </div>
            <div class="hud-hint" id="hud-hint-text">Click to expand details...</div>
        `;
        
        card.innerHTML = initialContent;
        
        // 3. Click Event for Toggle
        card.addEventListener('click', () => {
            const detailArea = document.getElementById('hud-text-area');
            const hintText = document.getElementById('hud-hint-text');

            if (!card.classList.contains('expanded')) {
                // --- EXPAND (Show Detail & Speak) ---
                card.classList.add('expanded');
                hintText.textContent = "Click to collapse";
                
                // Show Long Text (Formatted)
                const formattedDetail = screenData.detailed_analysis ? formatTextForHTML(screenData.detailed_analysis) : "No details available.";
                detailArea.innerHTML = formattedDetail;
                
                // Speak only if NOT spoken before
                if (!hasSpokenDetailed) {
                    const cleanSpeech = cleanTextForSpeech(screenData.detailed_analysis || "Here are the details.");
                    speakText(cleanSpeech, false); // False = don't overwrite caption
                    hasSpokenDetailed = true;
                }
            } else {
                // --- COLLAPSE (Show Short & Silence) ---
                card.classList.remove('expanded');
                hintText.textContent = "Click to expand details...";
                
                // Show Short Text again
                detailArea.innerHTML = formatTextForHTML(screenData.short_summary);
                
                // STOP SPEAKING IMMEDIATELY
                speechSynthesis.cancel();
                playAnimation("idle");
            }
        });
        
        document.getElementById('container').appendChild(card);
    }, 1000);
}

function removeHUD() {
    const existing = document.getElementById('active-hud-card');
    if (existing) existing.remove();
}

// --- NEW USER VOICE ENROLLMENT ---
function handleNewUserWelcome(username) {
    const welcomeText = `Hello ${username}! My name is Buddy. Before we begin, please tell me something about yourself.`;
    
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


// --- Core Logic ---
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

        // MODIFIED: Logic to handle speech depending on HUD mode
        if (data.spoken_text && data.type !== "animation_command" && data.type !== "describe_object" && data.type !== "look_at_screen") {
            if (data.type === "math_sequence") {
                speakText(data.spoken_text, false);
            } else {
                speakText(data.spoken_text, true);
            }
        } 
        // SPECIAL CASE: For look_at_screen, speak the short summary immediately without caption overlay
        else if (data.type === "look_at_screen" && data.spoken_text) {
             speakText(data.spoken_text, false); // False = don't caption, use HUD
        }
        else {
            askButton.disabled = false;
            micButton.disabled = false;
        }

    } catch (error) {
        console.error(error);
        speakText("Oh no, my brain circuits are tangled!", true);
        askButton.disabled = false;
        micButton.disabled = false;
    }
}


// --- Visual Output Rendering ---
async function renderVisualOutput(data) {
    clearOverlays(); 
    clearHologram(); 
    removeHUD(); 
    
    // --- FIX: Remove previous comparison before showing new one ---
    removeComparisonContainer();

    switch (data.type) {
        case "look_at_screen":
            if (data.screen_data) {
                showHUD(data.screen_data); 
            }
            break;
        case "toggle_perception":
            if (isPerceiving) {
                stopPerceptionMode();
                speakText("Okay, I'll stop observing now.", true);
            } else {
                startPerceptionMode();
            }
            break;
        case "open_camera":
            try {
                const photoResult = await handlePhotoCapture('save');
                displayCapturedPhoto(photoResult.imageDataUrl);
                speakText(`Hey ${photoResult.filename}, this is your image.`, true);
            } catch (error) {
                console.log(error);
                if (error !== "Camera closed by user") {
                    speakText("Okay, maybe next time.", true);
                }
            }
            break;
        case "introduce_friend":
            startIntroductionFlow();
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
        case "hologram_topic":
            createHologram(data);
            break;
            
        case "comparison_topic":
            // --- FIX: Use our new dedicated handler ---
            handleComparisonDisplay(data);
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
        case "play_youtube": 
        case "play_movie":
            if (data.movie_url) {
                showMovieModal(data.movie_title, data.movie_url);
            }
            break;
    }
}

// --- NEW FUNCTION: HANDLE COMPARISON DISPLAY (FIXES IMAGES) ---
function handleComparisonDisplay(data) {
    const img1Url = data.image_url_1;
    const img2Url = data.image_url_2;

    if (!img1Url && !img2Url) {
        console.error("Comparison images missing from data");
        return;
    }

    // 1. Create Container
    const container = document.createElement('div');
    container.id = 'comparison-container';
    container.style.cssText = `
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 50px;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 2000;
        background: rgba(0, 0, 0, 0.6);
        padding: 30px;
        border-radius: 20px;
        backdrop-filter: blur(5px);
    `;

    // 2. Helper to make image box
    const createBox = (url, label) => {
        const wrapper = document.createElement('div');
        wrapper.style.textAlign = 'center';

        const img = document.createElement('img');
        // Use proxy-image to bypass CORS, fall back to placeholder on error
        img.src = url ? `/proxy-image?url=${encodeURIComponent(url)}` : 'https://via.placeholder.com/300?text=No+Image';
        img.style.cssText = `
            width: 300px; 
            height: 300px; 
            object-fit: cover; 
            border: 4px solid #00f3ff; 
            border-radius: 15px; 
            box-shadow: 0 0 20px #00f3ff;
            background: #000;
        `;
        img.onerror = function() {
            this.src = 'https://via.placeholder.com/300?text=Image+Load+Error';
        };

        wrapper.appendChild(img);
        return wrapper;
    };

    // 3. Add Left Image
    container.appendChild(createBox(img1Url));

    // 4. Add "VS" Text
    const vsText = document.createElement('div');
    vsText.textContent = "VS";
    vsText.style.cssText = `
        font-family: 'Orbitron', sans-serif;
        font-size: 60px;
        font-weight: bold;
        color: white;
        text-shadow: 0 0 10px red;
    `;
    container.appendChild(vsText);

    // 5. Add Right Image
    container.appendChild(createBox(img2Url));

    // 6. Close on Click
    container.addEventListener('click', () => removeComparisonContainer());

    document.body.appendChild(container);
}

function removeComparisonContainer() {
    const existing = document.getElementById('comparison-container');
    if (existing) existing.remove();
}

// --- Introduction Flow (Unchanged) ---
let introModalStream = null;

function startIntroductionFlow() {
    const modal = document.getElementById('introduction-modal-overlay');
    const nameStep = document.getElementById('intro-name-step');
    const cameraStep = document.getElementById('intro-camera-step');
    const nameInput = document.getElementById('friend-name-input');
    const instructions = document.getElementById('intro-modal-instructions');
    const nextBtn = document.getElementById('intro-modal-next-btn');
    const captureBtn = document.getElementById('intro-modal-capture-btn');
    const cancelBtn = document.getElementById('intro-modal-cancel-btn');
    const video = document.getElementById('intro-modal-video');
    
    nameInput.value = '';
    instructions.textContent = "What is your friend's name?";
    nameStep.classList.remove('hidden');
    cameraStep.classList.add('hidden');
    nextBtn.classList.remove('hidden');
    captureBtn.classList.add('hidden');
    
    modal.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    modal.classList.add('opacity-100');

    nextBtn.onclick = async () => {
        const friendName = nameInput.value.trim();
        if (!friendName) {
            speakText("Please tell me your friend's name.", true);
            return;
        }
        
        instructions.textContent = `Alright ${friendName}, please look at the camera!`;
        nameStep.classList.add('hidden');
        cameraStep.classList.remove('hidden');
        nextBtn.classList.add('hidden');
        captureBtn.classList.remove('hidden');

        try {
            introModalStream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = introModalStream;
        } catch (err) {
            console.error("Error accessing camera for introduction:", err);
            speakText("I can't access the camera. Please check your browser permissions.", true);
            closeIntroductionModal();
        }
    };

    captureBtn.onclick = async () => {
        const friendName = nameInput.value.trim();
        const canvas = document.getElementById('intro-modal-canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg');

        instructions.textContent = `Remembering ${friendName}...`;
        captureBtn.disabled = true;
        cancelBtn.disabled = true;

        try {
            const response = await fetch('/face/register-friend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    friend_name: friendName,
                    image_data: imageDataUrl
                })
            });
            const resultData = await response.json();
            
            if (!response.ok) {
                throw new Error(resultData.error || "An unknown error occurred.");
            }
            
            speakText(`It's a pleasure to meet you, ${friendName}. I'll remember you now.`, true);

        } catch (error) {
            console.error("Introduction Flow Error:", error);
            speakText(`I had some trouble remembering that face. The error was: ${error.message}`, true);
        } finally {
            closeIntroductionModal();
        }
    };

    cancelBtn.onclick = () => {
        speakText("Okay, maybe next time.", true);
        closeIntroductionModal();
    };
}

function closeIntroductionModal() {
    const modal = document.getElementById('introduction-modal-overlay');
    const captureBtn = document.getElementById('intro-modal-capture-btn');
    const cancelBtn = document.getElementById('intro-modal-cancel-btn');
    
    if (introModalStream) {
        introModalStream.getTracks().forEach(track => track.stop());
        introModalStream = null;
    }
    
    modal.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => {
        modal.classList.add('hidden');
        captureBtn.disabled = false;
        cancelBtn.disabled = false;
    }, 300);
}

function resetSceneAndVisuals() {
    clearOverlays();
    clearHologram(); 
    removeHUD(); // Ensure HUD is gone
    removeComparisonContainer(); // Ensure comparison is gone
    resetSceneBackground();
    
    const panoramaContainer = document.getElementById('home-base-panorama');
    if (panoramaContainer) {
        panoramaContainer.style.display = 'block';
    }

    askButton.disabled = false;
    micButton.disabled = false;
}


// --- PERCEPTION MODE ---
async function activatePerceptionCamera() {
    const videoEl = document.getElementById('camera-video');
    if (!videoEl) {
        console.error("The <video id='camera-video'> element is missing.");
        return false;
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            if (perceptionStream) {
                perceptionStream.getTracks().forEach(track => track.stop());
            }
            perceptionStream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoEl.srcObject = perceptionStream;
            await videoEl.play();
            videoEl.classList.remove('hidden');
            return true;
        } catch (err) {
            console.error("Error accessing webcam for perception:", err);
            speakText("I can't start watching without camera access.", true);
            return false;
        }
    }
    return false;
}

function deactivatePerceptionCamera() {
    const videoEl = document.getElementById('camera-video');
    if (perceptionStream) {
        perceptionStream.getTracks().forEach(track => track.stop());
        perceptionStream = null;
    }
    if (videoEl) {
        videoEl.classList.add('hidden');
    }
}

async function getSilentCameraFrame() {
    return new Promise((resolve, reject) => {
        const videoElement = document.getElementById('camera-video');
        if (!videoElement || !videoElement.srcObject || videoElement.readyState < 2) {
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

// --- NEW ROBUST PERCEPTION LOOP (Using recursive Timeout instead of Interval) ---
async function startPerceptionMode() {
    if (isPerceiving) return;

    const cameraStarted = await activatePerceptionCamera();
    if (!cameraStarted) return;

    isPerceiving = true;
    speakText("Perception mode activated. I'll let you know if I see anything interesting.", true);

    // Start the Loop
    analyzeScene(); 
}

async function analyzeScene() {
    // 1. Safety Check: Am I still allowed to run?
    if (!isPerceiving) return;

    try {
        const frame = await getSilentCameraFrame();
        
        // 2. Send to Backend
        const res = await fetch('/analyze-environment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_data: frame }),
        });

        if (!res.ok) throw new Error("Server error");

        const data = await res.json();
        
        // 3. CRITICAL STOP CHECK: Did the user click Stop while I was waiting?
        if (!isPerceiving) return; 

        if (data.speak && !speechSynthesis.speaking) {
            speakText(data.text, true);
        }

    } catch (error) {
        console.error("Perception skipped:", error);
    } finally {
        // 4. Schedule NEXT loop only if still Perceiving
        if (isPerceiving) {
            // Wait 5 seconds BEFORE taking the next photo
            perceptionTimeout = setTimeout(analyzeScene, 5000); 
        }
    }
}

function stopPerceptionMode() {
    console.log("🛑 Stopping Perception...");
    isPerceiving = false; // This kills the loop immediately
    
    // Clear pending timeouts
    if (perceptionTimeout) {
        clearTimeout(perceptionTimeout);
        perceptionTimeout = null;
    }
    
    // Clear old intervals if any exist
    if (perceptionInterval) {
        clearInterval(perceptionInterval);
        perceptionInterval = null;
    }
    
    deactivatePerceptionCamera();
    speakText("Perception mode off.", true);
}


// --- SPEECH SYNTHESIS ---
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
        // Don't auto-clear if we have an active HUD (user needs to click it)
        if (!document.getElementById('active-hud-card')) {
             clearCapturedPhoto();
             setTimeout(() => {
                clearOverlays();
                clearHologram();
                removeComparisonContainer(); // Clear comparison when done talking (optional, but clean)
             }, 3000);
        }
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
            topText.appendChild(document.createTextNode(' '));
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

// --- PYTHON-BASED SPEECH RECOGNITION FIX ---
// --- PYTHON-BASED SPEECH RECOGNITION FIX ---
function setupSpeechToTextPython() {
    // 1. Check if browser supports media devices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("Microphone access not supported in this environment.");
        micButton.style.display = 'none';
        return;
    }

    // 2. Add Click Listener
    micButton.addEventListener("click", async () => {
        if (isRecordingQuery) return; // Prevent double clicks

        isRecordingQuery = true;
        micButton.classList.add("listening");
        speechSynthesis.cancel();
        clearOverlays();
        chatInput.value = "Listening...";

        try {
            // 3. Start Recording
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // FIX 1: Explicitly request WebM (standard for browsers)
            const options = { mimeType: 'audio/webm' };
            const mediaRecorder = new MediaRecorder(stream, options);
            let chunks = [];

            mediaRecorder.ondataavailable = e => chunks.push(e.data);

            mediaRecorder.onstop = async () => {
                // FIX 2: Create Blob with the CORRECT type
                const blob = new Blob(chunks, { type: 'audio/webm' }); 
                const formData = new FormData();
                formData.append('audio_data', blob);

                chatInput.value = "Thinking...";
                
                try {
                    const response = await fetch('/voice/listen', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const data = await response.json();
                    
                    if (data.status === 'success' && data.text) {
                        chatInput.value = data.text;
                        processInput(data.text);
                    } else {
                        chatInput.value = "";
                        speakText("I didn't catch that. Could you say it again?", true);
                    }
                } catch (err) {
                    console.error("STT Error:", err);
                    chatInput.value = "";
                    speakText("My ears are having trouble connecting.", true);
                }

                // Cleanup
                isRecordingQuery = false;
                micButton.classList.remove("listening");
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();

            // 4. Auto-Stop after 6 seconds
            setTimeout(() => {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            }, 6000); 

        } catch (err) {
            console.error("Microphone Error:", err);
            isRecordingQuery = false;
            micButton.classList.remove("listening");
            speakText("I cannot access the microphone.", true);
        }
    });
}
// ... existing code ...

window.addEventListener('media-processed', (event) => {
    const data = event.detail;
    if (data.spoken_text) {
        // Assuming you have a function to make avatar speak
        // Replace 'handleVoiceResponse' with whatever function you use
        // e.g. speak(data.spoken_text) or similar.
        console.log("Avatar speaking:", data.spoken_text);
        
        // If using your existing architecture:
        import('./avatar.js').then(module => {
             module.speak(data.spoken_text); 
        });
    }
});

// --- STEP 8: PROACTIVE HEARTBEAT ---
function startHeartbeat() {
    console.log("💓 Heartbeat started...");
    setInterval(async () => {
        // Don't interrupt if already speaking or recording
        if (speechSynthesis.speaking || isRecordingQuery) return;

        try {
            const response = await fetch('/check_pulse');
            if (!response.ok) return;
            
            const data = await response.json();
            
            if (data.found && data.message) {
                console.log("PULSE: New file detected!");
                speakText(data.message, true);
            }
        } catch (err) {
            // Silent fail is fine for heartbeat to avoid console spam
        }
    }, 5000); // Check every 5 seconds
}

// --- TOGGLE MENU FUNCTION (Cleaned Up - Only One Version) ---
function toggleMenu() {
    const menu = document.querySelector('.media-menu');
    if (menu) {
        if (menu.classList.contains('show')) {
            menu.classList.remove('show');
        } else {
            menu.classList.add('show');
        }
    }
}