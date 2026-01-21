import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- Scene Setup ---
const scene = new THREE.Scene();
export { scene }; // Make the scene available to other modules like hologram.js

// CRITICAL FOR TRANSPARENCY:
// We do NOT set a background color here. We want it to be null (transparent).
scene.background = null; 

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.5, 5);

// --- RENDERER SETUP (THE IRON MAN FIX) ---
// 1. alpha: true allows the canvas to be transparent.
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

// 2. setClearColor(0x000000, 0) tells the GPU: "Clear the screen to 0% opacity black"
// This stops the black box from appearing behind the character.
renderer.setClearColor(0x000000, 0); 

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

// --- Ground Setup ---
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({ color: 0xcccccc })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
// Hide ground by default so he floats on the desktop
ground.visible = false; 
scene.add(ground);

// --- Lights & Controls ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
scene.add(directionalLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.update();

// --- Character & Animation Variables ---
let mixer, character;
const animations = new Map();
const clock = new THREE.Clock();
const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
let currentAnimation = null;
let animationTimeout;
const IDLE_ANIM_NAME = 'idle';

// --- Initialization Function ---
export function initAvatar() {
    const container = document.getElementById('container');
    if (!container) {
        console.error("Container element not found!");
        return;
    }
    container.appendChild(renderer.domElement);

    const CHARACTER_MODEL_PATH = '/static/character.glb';

    gltfLoader.load(CHARACTER_MODEL_PATH, (gltf) => {
        character = gltf.scene;

        // --- POSITION FIX ---
        // Lower the character so feet aren't floating too high
        character.position.y = -0.7; 
        
        character.traverse(function (node) {
            if (node.isMesh) {
                node.castShadow = true;
            }
        });

        scene.add(character);
        mixer = new THREE.AnimationMixer(character);
        
        gltf.animations.forEach((clip) => {
            const clipName = clip.name.toLowerCase() === 'jum' ? 'jump' : clip.name.toLowerCase();
            animations.set(clipName, mixer.clipAction(clip));
        });

        if (animations.has(IDLE_ANIM_NAME)) {
            playAnimation(IDLE_ANIM_NAME);
        } else if (gltf.animations.length > 0) {
            playAnimation(gltf.animations[0].name.toLowerCase());
        }
    }, undefined, (error) => {
        console.error('An error happened while loading the character model:', error);
        const errorDiv = document.createElement('div');
        errorDiv.textContent = 'Error: Could not load 3D character. Check console.';
        errorDiv.style.color = 'red';
        container.appendChild(errorDiv);
    });

    // Make character look at mouse
    window.addEventListener('mousemove', (event) => {
        const normalizedX = (event.clientX / window.innerWidth) * 2 - 1;
        if (character) {
            // Limit rotation so he doesn't break his neck (0.5 radian limit)
            character.rotation.y = normalizedX * 0.5;
        }
    });

    // Handle Window Resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    renderer.render(scene, camera);
}

// --- Helper Functions ---

export function playAnimation(name, duration = null) {
    const animName = name.toLowerCase();
    
    if (!animations.has(animName) || animName === currentAnimation) {
        return;
    }

    clearTimeout(animationTimeout);

    const previousAction = currentAnimation ? animations.get(currentAnimation) : null;
    const action = animations.get(animName);

    if (previousAction) {
        previousAction.fadeOut(0.3);
    }
    
    action.timeScale = ["dance", "jump", "walk"].includes(animName) ? 0.5 : 1;

    action.reset();
    action.setEffectiveWeight(1);
    action.fadeIn(0.3).play();
    
    currentAnimation = animName;

    const isLooping = ["idle", "talk", "walk"].includes(animName);
    action.loop = isLooping ? THREE.LoopRepeat : THREE.LoopOnce;
    action.clampWhenFinished = !isLooping;

    if (!isLooping) {
        mixer.addEventListener('finished', function onFinished(e) {
            if (e.action === action) {
                mixer.removeEventListener('finished', onFinished);
                playAnimation('idle');
            }
        });
    }

    if (duration) {
        animationTimeout = setTimeout(() => {
            playAnimation('idle');
        }, duration);
    }
}

export function getCurrentAnimation() {
    return currentAnimation;
}

// --- Scene Background Helpers ---

export function changeSceneBackground(imageUrl, speakTextCallback) {
    textureLoader.load(imageUrl, 
        (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.background = texture;
            scene.environment = texture;
            // Ground acts as a shadow catcher mostly, keep hidden for 360 scenes usually
            ground.visible = false; 
        }, 
        undefined, 
        (err) => {
            console.error('Error loading background texture:', err);
            if (speakTextCallback) {
                speakTextCallback("I had some trouble loading that scene.", true);
            }
            resetSceneBackground();
        }
    );
}

export function resetSceneBackground() {
    // When we reset, we go back to NULL (Transparent)
    scene.background = null; 
    scene.environment = null;
    ground.visible = false;
}