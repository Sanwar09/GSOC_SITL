// /static/js/comparison.js
import * as THREE from 'three';
import { scene } from './avatar.js';

let comparisonGroup = null;
const textureLoader = new THREE.TextureLoader();
const loadingTexture = textureLoader.load('/static/loading.png');

export function createComparison(data) {
    clearComparison();
    comparisonGroup = new THREE.Group();
    scene.add(comparisonGroup);

    // Positions for Left and Right entities
    const positions = [
        new THREE.Vector3(-2.5, 1.5, 1.5), // Left side
        new THREE.Vector3(2.5, 1.5, 1.5)   // Right side
    ];

    // Create visuals for each entity
    data.entities.forEach((entity, index) => {
        createEntityDisplay(entity, positions[index]);
    });

    // Create the central "VS" logo
    const vsPanel = createTextPanel("VS", "", 256, 256); // Use a square canvas
    vsPanel.position.set(0, 1.8, 1.0);
    vsPanel.scale.set(0.01, 0.01, 0.01);
    comparisonGroup.add(vsPanel);

    // Animate the "VS" logo appearing
    setTimeout(() => animatePanelIn(vsPanel, 1.5), 500);
}

function createEntityDisplay(entity, position) {
    const entityGroup = new THREE.Group();
    entityGroup.position.copy(position);
    comparisonGroup.add(entityGroup);

    // Main Image/Model Display
    const mainMaterial = new THREE.MeshBasicMaterial({ map: loadingTexture, transparent: true, opacity: 0.95, blending: THREE.NormalBlending });
    const mainPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), mainMaterial);
    mainPlane.position.y = 1.0;
    entityGroup.add(mainPlane);
    
    // Load the real image in the background
    const proxiedImageUrl = `/proxy-image?url=${encodeURIComponent(entity.image_url)}`;
    textureLoader.load(proxiedImageUrl, (realTexture) => {
        mainPlane.material.map = realTexture;
        mainPlane.material.needsUpdate = true;
    });

    // Entity Name Panel
    const namePanel = createTextPanel(entity.name, "", 512, 128);
    namePanel.position.y = 2.1;
    entityGroup.add(namePanel);

    // Stat Panels
    entity.comparison_stats.forEach((stat, index) => {
        const statPanel = createTextPanel(stat.label, stat.value);
        statPanel.position.y = 0.2 - (index * 0.6); // Stagger stats downwards
        statPanel.scale.set(0.01, 0.01, 0.01); // Start hidden
        entityGroup.add(statPanel);
        
        // Animate each stat panel appearing after a delay
        setTimeout(() => animatePanelIn(statPanel), 1000 + (index * 200));
    });

    // Animate the entire entity display flying in
    entityGroup.scale.set(0.01, 0.01, 0.01);
    animatePanelIn(entityGroup);
}

function animatePanelIn(panel, finalScale = 1.0) {
    let scale = 0.01;
    const animate = () => {
        if (scale < finalScale) {
            scale += 0.08;
            panel.scale.set(scale, scale, scale);
            requestAnimationFrame(animate);
        } else {
            panel.scale.set(finalScale, finalScale, finalScale);
        }
    };
    animate();
}

function createTextPanel(label, value, width = 512, height = 256) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;

    context.fillStyle = 'rgba(0, 50, 70, 0.5)';
    context.fillRect(0, 0, width, height);

    context.strokeStyle = 'cyan';
    context.lineWidth = 10;
    context.strokeRect(0, 0, width, height);

    context.fillStyle = 'white';
    context.font = `bold ${height/6}px Inter, sans-serif`;
    context.textAlign = 'center';
    context.fillText(label, width / 2, height * 0.4);

    if (value) {
        context.fillStyle = '#00ffff';
        context.font = `${height/5}px Inter, sans-serif`;
        context.fillText(value, width / 2, height * 0.8);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.9 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width/512, height/512), material); // Scale plane to canvas aspect ratio
    
    return plane;
}

export function clearComparison() {
    if (comparisonGroup) {
        scene.remove(comparisonGroup);
        comparisonGroup.traverse(object => {
            if (object.isMesh) {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (object.material.map) object.material.map.dispose();
                    object.material.dispose();
                }
            }
        });
        comparisonGroup = null;
    }
}