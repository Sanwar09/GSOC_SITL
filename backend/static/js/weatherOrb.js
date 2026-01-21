// static/js/weatherOrb.js

import * as THREE from 'three';
import { scene } from './avatar.js';

let weatherOrbGroup = null;
let textSprites = [];
const textureLoader = new THREE.TextureLoader();

function createTextSprite(text, position, fontSize = 0.15) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const font = `Bold ${fontSize * 100}px Inter, sans-serif`;
    context.font = font;
    const width = context.measureText(text).width;
    canvas.width = width;
    canvas.height = fontSize * 120;

    context.font = font;
    context.fillStyle = '#00ffff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(width / 100, canvas.height / 100, 1.0);
    sprite.position.copy(position);
    return sprite;
}

function createWeatherParticles(weatherType) {
    const particleCount = weatherType === 'rain' ? 300 : 100;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 1.2;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 1.2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 1.2;

        if (weatherType === 'rain') {
            velocities[i * 3 + 1] = -Math.random() * 0.02 - 0.01; // Rain falls down
        } else { // clouds / clear
            velocities[i * 3] = (Math.random() - 0.5) * 0.001;
            velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.001;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.001;
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    
    let textureUrl, color;
    if (weatherType === 'clear') { textureUrl = '/static/textures/sun_particle.png'; color = 0xFFFF88; }
    else if (weatherType === 'rain') { textureUrl = '/static/textures/rain_particle.png'; color = 0xAAAAFF; }
    else { textureUrl = '/static/textures/cloud_particle.png'; color = 0xFFFFFF; } // clouds

    const material = new THREE.PointsMaterial({
        size: weatherType === 'clear' ? 0.5 : 0.1,
        map: textureLoader.load(textureUrl),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        color: color
    });

    return new THREE.Points(geometry, material);
}

export function createWeatherOrb(data) {
    destroyWeatherOrb(); // Clean up any existing orb

    weatherOrbGroup = new THREE.Group();
    weatherOrbGroup.position.set(0, 1.5, 2.5);

    // Main Orb Sphere
    const geometry = new THREE.SphereGeometry(0.7, 32, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.1,
        wireframe: true
    });
    const sphere = new THREE.Mesh(geometry, material);
    weatherOrbGroup.add(sphere);

    // Internal particles
    const particles = createWeatherParticles(data.main_weather);
    weatherOrbGroup.add(particles);

    // Holographic Text
    const cityText = createTextSprite(data.city, new THREE.Vector3(0, 1.0, 0), 0.2);
    const tempText = createTextSprite(`${data.temp}°C`, new THREE.Vector3(0.9, 0, 0), 0.25);
    const descText = createTextSprite(data.description, new THREE.Vector3(-0.9, 0, 0), 0.15);
    
    textSprites = [cityText, tempText, descText];
    weatherOrbGroup.add(cityText, tempText, descText);

    scene.add(weatherOrbGroup);

    // Initial animation
    weatherOrbGroup.scale.set(0.01, 0.01, 0.01);
    let scale = 0.01;
    const animateIn = () => {
        if (scale < 1) {
            scale += 0.05;
            weatherOrbGroup.scale.set(scale, scale, scale);
            requestAnimationFrame(animateIn);
        }
    };
    animateIn();
}

export function updateWeatherOrb(time) {
    if (!weatherOrbGroup) return;

    weatherOrbGroup.rotation.y += 0.005;

    // Animate particles
    const particles = weatherOrbGroup.children.find(child => child.isPoints);
    if (particles) {
        const positions = particles.geometry.attributes.position.array;
        const velocities = particles.geometry.attributes.velocity.array;
        for (let i = 0; i < positions.length / 3; i++) {
            positions[i * 3] += velocities[i * 3];
            positions[i * 3 + 1] += velocities[i * 3 + 1];
            positions[i * 3 + 2] += velocities[i * 3 + 2];

            // Reset rain particles
            if (velocities[i * 3 + 1] < 0 && positions[i * 3 + 1] < -0.6) {
                positions[i * 3 + 1] = 0.6;
            }
            // Boundary checks for clouds/sun
            if (Math.sqrt(positions[i*3]**2 + positions[i*3+1]**2 + positions[i*3+2]**2) > 0.65) {
                positions[i*3] = (Math.random() - 0.5) * 1.2;
                positions[i*3+1] = (Math.random() - 0.5) * 1.2;
                positions[i*3+2] = (Math.random() - 0.5) * 1.2;
            }
        }
        particles.geometry.attributes.position.needsUpdate = true;
    }

    // Animate text orbit
    if (textSprites.length > 0) {
        textSprites[1].position.x = Math.cos(time * 0.5) * 1.0;
        textSprites[1].position.z = Math.sin(time * 0.5) * 1.0;
        textSprites[2].position.x = Math.cos(time * 0.5 + Math.PI) * 1.0;
        textSprites[2].position.z = Math.sin(time * 0.5 + Math.PI) * 1.0;
    }
}

export function destroyWeatherOrb() {
    if (weatherOrbGroup) {
        scene.remove(weatherOrbGroup);
        weatherOrbGroup.traverse(object => {
            if (object.isMesh || object.isSprite || object.isPoints) {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (object.material.map) object.material.map.dispose();
                    object.material.dispose();
                }
            }
        });
        weatherOrbGroup = null;
        textSprites = [];
    }
}