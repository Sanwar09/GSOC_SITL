// /static/js/hologram.js (Updated with Choreographed Reveal)

import * as THREE from 'three';
import { scene } from './avatar.js';

let hologramGroup = null;
const textureLoader = new THREE.TextureLoader();
const loadingTexture = textureLoader.load('/static/loading.png');

export function createHologram(data) {
    clearHologram();
    hologramGroup = new THREE.Group();
    hologramGroup.position.set(0, 0, 1.0);

    // --- Main Image Display ---
    if (data.image_url) {
        const mainMaterial = new THREE.MeshBasicMaterial({
            map: loadingTexture,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide,
            blending: THREE.NormalBlending,
        });

        const mainPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), mainMaterial);
        mainPlane.position.set(0, 2.0, 0);
        hologramGroup.add(mainPlane);

        const proxiedImageUrl = `/proxy-image?url=${encodeURIComponent(data.image_url)}`;
        textureLoader.load(
            proxiedImageUrl,
            (realTexture) => {
                if (mainPlane && mainPlane.material) {
                    mainPlane.material.map = realTexture;
                    mainPlane.material.needsUpdate = true;
                }
            },
            undefined,
            (err) => {
                console.error('Failed to load hologram image:', err);
            }
        );
    }

    // --- Information Panels ---
    const panels = []; // ✅ We'll keep track of the panels to animate them later.
    if (data.key_info && data.key_info.length > 0) {
        const panelCount = data.key_info.length;
        const arcRadius = 3.0;
        const arcAngleTotal = Math.PI * (2 / 3);
        
        data.key_info.forEach((info, index) => {
            const isSinglePanel = panelCount === 1;
            const t = isSinglePanel ? 0.5 : index / (panelCount - 1);
            const angle = (t - 0.5) * arcAngleTotal;

            const textPanel = createTextPanel(info.label, info.value);
            
            textPanel.position.x = Math.sin(angle) * arcRadius;
            textPanel.position.z = (Math.cos(angle) - 1) * 1.5;
            textPanel.position.y = 1.3 + (Math.sin(angle * 1.5) * 0.2);
            textPanel.lookAt(new THREE.Vector3(0, 1.2, 5));
            
            // ✅ Hide panels initially by scaling them down to almost nothing.
            textPanel.scale.set(0.01, 0.01, 0.01);
            
            hologramGroup.add(textPanel);
            panels.push(textPanel); // Add to our array for later animation.
        });
    }

    // --- Base Projector Ring ---
    const ringGeometry = new THREE.RingGeometry(2.8, 2.9, 128);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    hologramGroup.add(ring);

    scene.add(hologramGroup);
    animateAppearance();

    // ✅ NEW: Start the choreographed reveal of the info panels after a delay.
    // This gives the main image time to load and the avatar time to start speaking.
    setTimeout(() => {
        animatePanelsIn(panels);
    }, 1200); // 1.2-second delay before panels start appearing.
}

/**
 * ✅ NEW FUNCTION: Animates the info panels into view one by one.
 * @param {THREE.Mesh[]} panels - An array of the panel meshes to animate.
 */
function animatePanelsIn(panels) {
    panels.forEach((panel, index) => {
        // Stagger the animation start time for each panel.
        setTimeout(() => {
            let scale = 0.01;
            const animate = () => {
                if (scale < 1) {
                    scale += 0.08; // Animation speed
                    panel.scale.set(scale, scale, scale);
                    requestAnimationFrame(animate);
                } else {
                    panel.scale.set(1, 1, 1);
                }
            };
            animate();
        }, index * 200); // Each panel starts animating 200ms after the previous one.
    });
}


// --- Unchanged Functions Below ---

function createTextPanel(label, value) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const canvasWidth = 512;
    const canvasHeight = 256;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    context.fillStyle = 'rgba(0, 50, 70, 0.5)';
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    context.strokeStyle = 'cyan';
    context.lineWidth = 10;
    context.strokeRect(0, 0, canvasWidth, canvasHeight);

    context.fillStyle = 'white';
    context.font = 'bold 40px Inter, sans-serif';
    context.textAlign = 'center';
    context.fillText(label, canvasWidth / 2, 80);
    
    context.fillStyle = '#00ffff';
    context.font = '50px Inter, sans-serif';
    context.fillText(value, canvasWidth / 2, 170);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.9
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), material);
    return plane;
}

function animateAppearance() {
    if (!hologramGroup) return;
    hologramGroup.scale.set(0.01, 0.01, 0.01);
    
    let scale = 0.01;
    const animate = () => {
        if (scale < 1) {
            scale += 0.05;
            hologramGroup.scale.set(scale, scale, scale);
            requestAnimationFrame(animate);
        }
    };
    animate();
}

export function clearHologram() {
    if (hologramGroup) {
        scene.remove(hologramGroup);
        hologramGroup.traverse(object => {
            if (object.isMesh) {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (object.material.map) object.material.map.dispose();
                    object.material.dispose();
                }
            }
        });
        hologramGroup = null;
    }
}