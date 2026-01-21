// static/js/timerRing.js

import * as THREE from 'three';
import { scene } from './avatar.js';

let timerGroup = null;
let timeRemaining = 0;
let totalTime = 0;
let textSprite = null;

function createTimerText() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(3, 1.5, 1);
    sprite.position.y = 0.1;

    // Attach canvas and context for easy updates
    sprite.userData.canvas = canvas;
    sprite.userData.context = context;

    return sprite;
}

function updateTimerText() {
    if (!textSprite) return;
    const { canvas, context } = textSprite.userData;
    
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = Math.floor(timeRemaining % 60);
    const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = 'Bold 100px Inter, sans-serif';
    context.fillStyle = '#00ffff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(timeString, canvas.width / 2, canvas.height / 2);
    textSprite.material.map.needsUpdate = true;
}


export function createTimerRing(seconds) {
    destroyTimerRing(); // Clean up previous timer

    totalTime = seconds;
    timeRemaining = seconds;

    timerGroup = new THREE.Group();

    // Background Ring
    const bgGeo = new THREE.TorusGeometry(2, 0.05, 16, 100);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.2 });
    const bgRing = new THREE.Mesh(bgGeo, bgMat);
    bgRing.rotation.x = -Math.PI / 2;
    timerGroup.add(bgRing);

    // Progress Ring
    const progressGeo = new THREE.TorusGeometry(2, 0.1, 16, 100);
    const progressMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.9 });
    const progressRing = new THREE.Mesh(progressGeo, progressMat);
    progressRing.rotation.x = -Math.PI / 2;
    progressRing.userData.isProgressRing = true; // For easy selection
    timerGroup.add(progressRing);
    
    // Text
    textSprite = createTimerText();
    timerGroup.add(textSprite);

    scene.add(timerGroup);
    updateTimerText();

    // Animate in
    timerGroup.scale.set(0, 0, 0);
    let scale = 0;
    const animate = () => {
        if(scale < 1) {
            scale += 0.05;
            timerGroup.scale.set(scale, scale, scale);
            requestAnimationFrame(animate);
        }
    }
    animate();
}

export function updateTimerRing(deltaTime) {
    if (!timerGroup || timeRemaining <= 0) return;

    timeRemaining -= deltaTime;
    if (timeRemaining < 0) timeRemaining = 0;

    const progress = timeRemaining / totalTime;
    
    const progressRing = timerGroup.children.find(c => c.userData.isProgressRing);
    if (progressRing) {
        // We can't easily change Torus geometry, so we scale it down instead
        progressRing.scale.set(progress, progress, 1);
        progressRing.material.opacity = 0.5 + progress * 0.5;
    }
    
    updateTimerText();

    if (timeRemaining <= 0) {
        const alarmSound = document.getElementById("timer-alarm");
        if (alarmSound) alarmSound.play();
        
        // Flash effect
        const bgRing = timerGroup.children.find(c => !c.userData.isProgressRing && c.isMesh);
        let flashes = 0;
        const flashInterval = setInterval(() => {
            bgRing.material.color.set(flashes % 2 === 0 ? 0xffffff : 0x00ffff);
            flashes++;
            if (flashes > 5) {
                clearInterval(flashInterval);
                destroyTimerRing();
            }
        }, 200);
    }
}

export function destroyTimerRing() {
    if (timerGroup) {
        scene.remove(timerGroup);
        // Proper cleanup
        timerGroup.traverse(object => {
            if (object.isMesh || object.isSprite) {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                     if (object.material.map) object.material.map.dispose();
                    object.material.dispose();
                }
            }
        });
        timerGroup = null;
        textSprite = null;
        timeRemaining = 0;
        totalTime = 0;
    }
}

export function isTimerActive() {
    return timerGroup !== null && timeRemaining > 0;
}