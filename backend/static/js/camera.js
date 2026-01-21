let speakTextCallback; // To hold the speakText function from main.js

// --- DOM Elements ---
const cameraModalOverlay = document.getElementById('camera-modal-overlay');
const closeCameraBtn = document.getElementById('close-camera-btn');
const videoFeed = document.getElementById('video-feed');
const mainCanvas = document.getElementById('main-canvas');
const takePhotoButton = document.getElementById('take-photo-button');
const saveButton = document.getElementById('save-button');
const retakeButton = document.getElementById('retake-button');
const saveModal = document.getElementById('save-modal');
const filenameInput = document.getElementById('filename-input');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const cameraView = document.getElementById('camera-view');
const editingView = document.getElementById('editing-view');
const flashOverlay = document.getElementById('flash-overlay');
const sizeControlContainer = document.getElementById('size-control-container');
const sizeSlider = document.getElementById('size-slider');
const flipCameraButton = document.getElementById('flip-camera-button');
const describeButton = document.getElementById('describe-button');
const aiDescriptionContainer = document.getElementById('ai-description-container');
const aiDescriptionText = document.getElementById('ai-description-text');
const standardEditingControls = document.getElementById('standard-editing-controls');

// --- State Variables ---
let stream, currentFilter = "none", capturedImage, ctx;
let cameraIntent = 'save';
let videoDevices = [];
let currentDeviceIndex = 0;
let devicesInitialized = false;
let selectedObject = null, isDragging = false, dragStart = { x: 0, y: 0 }, objectStart = { x: 0, y: 0 };

export function initCamera(speakTextFunc) {
    speakTextCallback = speakTextFunc;
    
    if (mainCanvas) {
        ctx = mainCanvas.getContext("2d");
    } else {
        console.error("Fatal Error: 'main-canvas' element not found.");
        return;
    }

    // Add all event listeners
    if (flipCameraButton) flipCameraButton.addEventListener('click', flipCamera);
    if (describeButton) describeButton.addEventListener('click', describeImageFromCanvas);
    if (takePhotoButton) takePhotoButton.addEventListener('click', capturePhoto);
    if (retakeButton) retakeButton.addEventListener("click", () => {
        currentFilter = "none";
        selectedObject = null;
        sizeControlContainer.classList.add('hidden');
        aiDescriptionContainer.classList.add('hidden');
        aiDescriptionText.textContent = '';
        startCamera();
    });
    if (saveButton) saveButton.addEventListener('click', () => saveModal.classList.remove("hidden"));

    document.querySelectorAll(".filter-button").forEach(button => {
        button.addEventListener("click", () => {
            currentFilter = button.dataset.filter === "none" ? "none" : `${button.dataset.filter}(1)`;
            if (["saturate", "contrast", "brightness"].includes(button.dataset.filter)) {
                currentFilter = `${button.dataset.filter}(150%)`;
            } else if (button.dataset.filter === "blur") {
                currentFilter = "blur(5px)";
            }
            redrawCanvas();
        });
    });

    document.querySelectorAll(".emoji-button").forEach(button => {
        button.addEventListener("click", () => selectObject('emoji', button.dataset.emoji));
    });

    if (sizeSlider) sizeSlider.addEventListener("input", (e) => {
        if (selectedObject) {
            selectedObject.size = parseInt(e.target.value, 10);
            redrawCanvas();
        }
    });

    if (mainCanvas) {
        mainCanvas.addEventListener('mousedown', handleMouseDown);
        mainCanvas.addEventListener('mousemove', handleMouseMove);
        mainCanvas.addEventListener('mouseup', handleMouseUp);
        mainCanvas.addEventListener('mouseleave', handleMouseUp);
    }
}

export function handlePhotoCapture(intent) {
    return new Promise(async (resolve, reject) => {
        cameraIntent = intent;
        selectedObject = null;
        currentFilter = "none";
        aiDescriptionContainer.classList.add('hidden');
        aiDescriptionText.textContent = '';
        sizeControlContainer.classList.add('hidden');
        cameraModalOverlay.classList.remove("hidden");
        setTimeout(() => cameraModalOverlay.classList.add("visible"), 10);
        await initializeCameraDevices();
        startCamera();

        const onSaveClick = () => {
            const filename = filenameInput.value.trim() || "avatar-photo";
            if (selectedObject) redrawCanvas(true);
            const imageDataUrl = mainCanvas.toDataURL("image/jpeg");
            triggerAutoDownload(imageDataUrl, filename);
            cleanupAndClose();
            resolve({ imageDataUrl, filename });
        };

        const onCancelClick = () => {
            cleanupAndClose();
            reject("Camera closed by user");
        };

        const cleanupAndClose = () => {
            speechSynthesis.cancel();
            if (cameraIntent === 'describe') speakTextCallback("Okay, closing the camera now.", true);
            stopCamera();
            cameraModalOverlay.classList.remove("visible");
            setTimeout(() => cameraModalOverlay.classList.add("hidden"), 500);
            modalSaveBtn.removeEventListener('click', onSaveClick);
            closeCameraBtn.removeEventListener('click', onCancelClick);
            modalCancelBtn.removeEventListener('click', hideSaveModal);
        };

        const hideSaveModal = () => saveModal.classList.add("hidden");

        modalSaveBtn.addEventListener('click', onSaveClick, { once: true });
        closeCameraBtn.addEventListener('click', onCancelClick, { once: true });
        modalCancelBtn.addEventListener('click', hideSaveModal);
    });
}

// --- NEW SILENT CAPTURE FUNCTION ---
export function captureFaceForRegistration() {
    return new Promise(async (resolve, reject) => {
        const videoEl = document.getElementById('video-feed');
        if (!videoEl) {
            return reject("Video element not found for registration.");
        }
        
        let localStream;
        const tempCanvas = document.createElement('canvas'); // Use a temporary canvas
        
        try {
            const constraints = { video: { facingMode: "user", width: 640, height: 480 } };
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
            videoEl.srcObject = localStream;

            // Style the video feed as a small, non-interactive preview
            videoEl.style.position = 'fixed';
            videoEl.style.top = '20px';
            videoEl.style.left = '20px';
            videoEl.style.width = '240px';
            videoEl.style.height = '180px';
            videoEl.style.zIndex = '2000';
            videoEl.style.borderRadius = '12px';
            videoEl.style.border = '3px solid #00aaff';
            videoEl.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
            videoEl.classList.remove('hidden');
            
            await videoEl.play();

            // Give the camera a moment to initialize and adjust
            await new Promise(r => setTimeout(r, 1500)); 

            tempCanvas.width = videoEl.videoWidth;
            tempCanvas.height = videoEl.videoHeight;
            const context = tempCanvas.getContext('2d');
            context.drawImage(videoEl, 0, 0, tempCanvas.width, tempCanvas.height);
            const imageDataUrl = tempCanvas.toDataURL('image/jpeg', 0.9);

            resolve({ imageDataUrl });

        } catch (err) {
            console.error("Error during silent capture:", err);
            if (speakTextCallback) speakTextCallback("I couldn't access the camera. Please check browser permissions.", true);
            reject("Camera access failed.");
        } finally {
            // IMPORTANT: Clean up and turn off the camera
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            videoEl.srcObject = null;
            videoEl.classList.add('hidden');
            videoEl.removeAttribute('style'); // Remove all inline styles
        }
    });
}
// --- END NEW FUNCTION ---

async function initializeCameraDevices() {
    if (devicesInitialized) return;
    try {
        await navigator.mediaDevices.getUserMedia({video: true}); // Prompt for permission
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = devices.filter(device => device.kind === 'videoinput');
        if (videoDevices.length > 0) {
            devicesInitialized = true;
        }
    } catch (err) {
        console.error("Error enumerating devices: ", err);
    }
}

async function startCamera() {
    if (videoDevices.length === 0 && !devicesInitialized) {
        await initializeCameraDevices(); // Try one more time
    }
    if (videoDevices.length === 0) {
        alert("No camera found. Please ensure it's connected and permissions are granted in your browser settings.");
        return;
    }
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    const constraints = { video: { deviceId: { exact: videoDevices[currentDeviceIndex].deviceId } } };
    try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoFeed.srcObject = stream;
        await videoFeed.play();
        cameraView.classList.remove("hidden");
        editingView.classList.add("hidden");
        editingView.classList.remove("flex");
        takePhotoButton.classList.remove("hidden");
    } catch (err) {
        console.error("Error accessing camera: ", err);
        alert(`Could not access the camera. Please check permissions. Error: ${err.name}`);
    }
}

function stopCamera() {
    if (stream) stream.getTracks().forEach(track => track.stop());
}

function flipCamera() {
    if (videoDevices.length > 1) {
        currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
        startCamera();
    }
}

function capturePhoto() {
    mainCanvas.width = videoFeed.videoWidth;
    mainCanvas.height = videoFeed.videoHeight;
    ctx.drawImage(videoFeed, 0, 0, mainCanvas.width, mainCanvas.height);
    capturedImage = new Image();
    capturedImage.src = mainCanvas.toDataURL("image/jpeg");
    capturedImage.onload = () => {
        cameraView.classList.add("hidden");
        editingView.classList.remove("hidden");
        editingView.classList.add("flex");
        stopCamera();
        flashEffect();

        if (cameraIntent === 'describe') {
            saveButton.classList.add('hidden');
            describeButton.classList.remove('hidden');
            standardEditingControls.classList.add('hidden');
            sizeControlContainer.classList.add('hidden');
            describeImageFromCanvas();
        } else {
            saveButton.classList.remove('hidden');
            describeButton.classList.add('hidden');
            standardEditingControls.classList.remove('hidden');
        }
    }
}

async function describeImageFromCanvas() {
    aiDescriptionContainer.classList.add('hidden');
    aiDescriptionText.textContent = 'Analyzing...';
    aiDescriptionContainer.classList.remove('hidden');
    const imageDataUrl = mainCanvas.toDataURL("image/jpeg");
    try {
        const response = await fetch('/describe-object', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_data: imageDataUrl }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Server error");
        aiDescriptionText.textContent = data.description;
        speakTextCallback(data.description, false);
    } catch (error) {
        console.error("Error describing image:", error);
        const errorMessage = "Sorry, I couldn't describe that image.";
        aiDescriptionText.textContent = errorMessage;
        speakTextCallback(errorMessage, false);
    }
}

function flashEffect() {
    flashOverlay.classList.remove("hidden");
    setTimeout(() => flashOverlay.classList.add("hidden"), 500);
}

function redrawCanvas(isFinalDraw = false) {
    if (!ctx || !capturedImage) return;
    ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    ctx.filter = currentFilter;
    ctx.drawImage(capturedImage, 0, 0);
    ctx.filter = "none";

    if (selectedObject) {
        const { type, value, size, position } = selectedObject;
        if (type === 'emoji') {
            ctx.font = `${size}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(value, position.x, position.y);
            if (!isFinalDraw && cameraIntent !== 'describe') {
                ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.strokeRect(position.x - size / 2, position.y - size / 2, size, size);
            }
        }
    }
}

function selectObject(type, value) {
    selectedObject = {
        type, value,
        size: parseInt(sizeSlider.value, 10),
        position: { x: mainCanvas.width / 2, y: mainCanvas.height / 2 }
    };
    sizeControlContainer.classList.remove('hidden');
    redrawCanvas();
}

function triggerAutoDownload(dataUrl, filename) {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${filename}.jpeg`;
    link.click();
}

function handleMouseDown(e) {
    if (!selectedObject) return;
    const { mouseX, mouseY } = getMousePos(e);
    const { position, size } = selectedObject;
    if (mouseX > position.x - size / 2 && mouseX < position.x + size / 2 &&
        mouseY > position.y - size / 2 && mouseY < position.y + size / 2) {
        isDragging = true;
        mainCanvas.style.cursor = 'grabbing';
        dragStart = { x: mouseX, y: mouseY };
        objectStart = { ...position };
    }
}

function handleMouseMove(e) {
    if (!isDragging || !selectedObject) return;
    const { mouseX, mouseY } = getMousePos(e);
    selectedObject.position.x = objectStart.x + (mouseX - dragStart.x);
    selectedObject.position.y = objectStart.y + (mouseY - dragStart.y);
    redrawCanvas();
}

function handleMouseUp() {
    isDragging = false;
    mainCanvas.style.cursor = 'grab';
}

function getMousePos(e) {
    const rect = mainCanvas.getBoundingClientRect();
    const scaleX = mainCanvas.width / rect.width;
    const scaleY = mainCanvas.height / rect.height;
    return {
        mouseX: (e.clientX - rect.left) * scaleX,
        mouseY: (e.clientY - rect.top) * scaleY
    };
}