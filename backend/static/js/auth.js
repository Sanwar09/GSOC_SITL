// static/js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname;

    if (page.includes('/register')) {
        initRegisterPage();
    } else if (page.includes('/login')) {
        initLoginPage();
    }
});

// --- REGISTRATION LOGIC ---
function initRegisterPage() {
    const registerForm = document.getElementById('register-form');
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    let username = '';

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const button = e.target.querySelector('button');
        button.disabled = true;
        button.textContent = "Creating...";

        const response = await fetch('/user/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
            startFaceRegistration(username);
        } else {
            const data = await response.json();
            alert(`Error: ${data.error}`);
            button.disabled = false;
            button.textContent = "Next: Scan Face";
        }
    });
}

async function startFaceRegistration(username) {
    const video = document.getElementById('video-feed');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const statusMessage = document.getElementById('status-message');
    const sampleLimit = 50;
    let samplesCollected = 0;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
    } catch (err) {
        statusMessage.textContent = "Error: Could not access camera.";
        return;
    }

    const captureInterval = setInterval(async () => {
        if (samplesCollected >= sampleLimit) {
            clearInterval(captureInterval);
            statusMessage.textContent = 'Training your profile... Please wait.';
            video.srcObject.getTracks().forEach(track => track.stop());

            const trainResponse = await fetch('/face/train', { method: 'POST' });
            if (trainResponse.ok) {
                alert('Registration successful! You will now be logged in.');
                // Log the user in after successful registration and face training
                const password = document.getElementById('password').value; // Get password again
                const loginResponse = await fetch('/user/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                if(loginResponse.ok) {
                    window.location.href = '/';
                } else {
                    alert('Auto-login failed. Please go to the login page.');
                    window.location.href = '/login';
                }
            } else {
                alert('Error training model. Please try registering again.');
            }
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');

        const response = await fetch('/face/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, image_data: imageData })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.message && data.message.startsWith('Saved sample')) {
                samplesCollected++;
                const percentage = Math.round((samplesCollected / sampleLimit) * 100);
                progressBar.style.width = `${percentage}%`;
                progressText.textContent = `${percentage}% Complete`;
                statusMessage.textContent = `Capturing face... ${percentage}%`;
            }
        } else {
            const data = await response.json();
             if (data.status) statusMessage.textContent = data.status;
        }
    }, 200);
}

// --- LOGIN LOGIC ---
function initLoginPage() {
    const video = document.getElementById('video-feed');
    const faceLoginBtn = document.getElementById('face-login-btn');
    const passwordLoginForm = document.getElementById('password-login-form');
    const statusMessage = document.getElementById('status-message');
    let recognitionInterval;
    let isRecognizing = false;

    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
        } catch (err) {
            statusMessage.textContent = "Camera access denied.";
            faceLoginBtn.disabled = true;
        }
    }
    
    faceLoginBtn.addEventListener('click', () => {
        if(isRecognizing) return;
        isRecognizing = true;
        statusMessage.textContent = "Detecting face...";
        faceLoginBtn.disabled = true;
        faceLoginBtn.textContent = "Scanning...";
        
        recognitionInterval = setInterval(async () => {
            if (!video.srcObject) return;
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg');

            const response = await fetch('/face/recognize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_data: imageData })
            });

            const data = await response.json();
            if (data.status === 'success') {
                clearInterval(recognitionInterval);
                video.srcObject.getTracks().forEach(track => track.stop());
                statusMessage.textContent = `Welcome, ${data.name}! Redirecting...`;
                window.location.href = '/';
            } else {
                 statusMessage.textContent = "Face not recognized. Trying again...";
            }
        }, 1500);
    });

    passwordLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearInterval(recognitionInterval); // Stop face scan if using password
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        const response = await fetch('/user/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        if (response.ok) {
            window.location.href = '/';
        } else {
            alert('Invalid username or password.');
        }
    });

    startCamera();
}