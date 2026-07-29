// src/main.js
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { itemsConfig, safeSpawns } from './config.js';
import { playShootSound, playExplosionSound, playReloadSound } from './audio.js';
import { buildMapGeometries, collidables, wallMeshes, mapWallMeshes, mapSpawnPoint, mapLoaded } from './map.js';
import { updateBotLogic } from './bot.js';

let gameMode = 'bot';
let playerNick = "Striker";
let playerMoney = 5000;

let inventory = { secondary: { key: 'deagle', ammo: 7, reserveAmmo: 35 }, primary: null, grenade: null };
let activeSlot = 'secondary';
let armorDurability = 0, helmetDurability = 0;

let lastShotTime = 0, isAiming = false, pointerLocked = false, buyMenuOpen = false, isMouseDown = false;
let scene, camera, renderer, composer, prevTime = performance.now();
let moveF = false, moveB = false, moveL = false, moveR = false, canJump = true;
let isRunning = false;
let velocity = new THREE.Vector3();
let hp = 100, isDead = false;

let gunGroup;
let loadedWeapons = {}; 
let currentWeaponModel = null;
let mixer = null; 
const gltfLoader = new GLTFLoader();

let bots = [], networkPlayers = {}; 
const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const downRaycaster = new THREE.Raycaster();
const downVector = new THREE.Vector3(0, -1, 0);

let peer, conn, peers = {}, isHost = false;

const btnStart = document.getElementById('btn-start');
const container = document.getElementById('canvas-container');
const pauseScreen = document.getElementById('pause-screen');
const buyMenu = document.getElementById('buy-menu');
const crosshairElem = document.getElementById('crosshair');
const scopeOverlay = document.getElementById('scope-overlay');

const weaponScales = {
    deagle: { scale: 0.008, pos: new THREE.Vector3(0, -0.15, -0.35) }, 
    p90:    { scale: 0.12,  pos: new THREE.Vector3(0, -0.15, -0.35) }, 
    ak47:   { scale: 0.35,  pos: new THREE.Vector3(0, -0.15, -0.35), rot: new THREE.Euler(0, 0, 0.1) },
    m4a4:   { scale: 0.020, pos: new THREE.Vector3(0, -0.15, -0.35) }, 
    awp:    { scale: 0.004, pos: new THREE.Vector3(0, -0.15, -0.35), rot: new THREE.Euler(0, 1.57, 0) },  
};

function takeDamage(amount) {
    if (isDead) return;
    let damage = amount;
    if (armorDurability > 0) {
        const absorbed = Math.min(armorDurability, damage * 0.5);
        armorDurability -= absorbed;
        damage -= absorbed;
    }
    hp -= damage;
    if (hp <= 0) {
        hp = 0;
        isDead = true;
        document.getElementById('kill-feed').innerText = "VOCÊ MORREU!";
        document.getElementById('kill-feed').style.display = 'block';
    }
    updateHUD();
}

function spawnBots() {
    bots.forEach(b => scene.remove(b.mesh));
    bots = [];
    if (gameMode !== 'bot') return;

    const botSpawns = safeSpawns.slice(1, 5);
    botSpawns.forEach((spawn, idx) => {
        const group = new THREE.Group();
        const torsoMat = new THREE.MeshStandardMaterial({ color: 0xb53333 });
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), torsoMat);
        torso.position.y = 0.9;
        group.add(torso);

        group.position.set(spawn.x, mapSpawnPoint.y + 1, spawn.z);
        scene.add(group);

        bots.push({
            mesh: group,
            pos: group.position,
            lastShot: 0,
            strafeDir: (idx % 2 === 0) ? 1 : -1
        });
    });
}

function preloadWeapons() {
    const weaponsToLoad = ['ak47', 'm4a4', 'awp', 'deagle', 'p90'];
    weaponsToLoad.forEach(w => {
        gltfLoader.load(`models/${w}.glb`, (gltf) => {
            const model = gltf.scene;
            model.traverse((child) => {
                if (child.isMesh && child.material) child.material.needsUpdate = true;
            });
            loadedWeapons[w] = { scene: model, animations: gltf.animations }; 
            if (w === getCurrentWeaponKey()) build3DWeapon();
        });
    });
}

function getCurrentWeaponKey() { return inventory[activeSlot] ? inventory[activeSlot].key : 'deagle'; }

function updateCrosshairAndScope() {
    const curKey = getCurrentWeaponKey();
    if (curKey === 'awp' && isAiming) {
        crosshairElem.style.display = 'none';
        scopeOverlay.style.display = 'block';
        if (currentWeaponModel) currentWeaponModel.visible = false;
        camera.fov = 20; 
    } else {
        scopeOverlay.style.display = 'none';
        crosshairElem.style.display = 'block';
        if (currentWeaponModel) currentWeaponModel.visible = true;
        camera.fov = (isAiming && itemsConfig[curKey].zoomFov) ? itemsConfig[curKey].zoomFov : 78;
    }
    camera.updateProjectionMatrix();
}

function build3DWeapon() {
    if (!gunGroup) return;
    while(gunGroup.children.length > 0) gunGroup.remove(gunGroup.children[0]);
    currentWeaponModel = null; mixer = null; 
    
    const curKey = getCurrentWeaponKey();
    const config = weaponScales[curKey] || { scale: 0.008, pos: new THREE.Vector3(0, -0.15, -0.35) };

    if (activeSlot === 'grenade') {
        const nade = new THREE.Mesh(new THREE.SphereGeometry(0.08), new THREE.MeshStandardMaterial({color: 0x2e3d29}));
        nade.position.copy(config.pos);
        gunGroup.add(nade);
        currentWeaponModel = nade;
    } else if (loadedWeapons[curKey]) {
        const weaponData = loadedWeapons[curKey];
        const wpnClone = SkeletonUtils.clone(weaponData.scene);
        wpnClone.scale.set(config.scale, config.scale, config.scale); 
        wpnClone.position.copy(config.pos); 
        wpnClone.rotation.set(0, Math.PI, 0); 
        gunGroup.add(wpnClone);
        currentWeaponModel = wpnClone;
    }
    updateCrosshairAndScope();
}

function updateHUD() {
    const curKey = getCurrentWeaponKey();
    const curData = itemsConfig[curKey] || itemsConfig.deagle;
    document.getElementById('hp').innerText = Math.max(0, Math.round(hp));
    document.getElementById('money-display').innerText = `$${playerMoney}`;
    
    if (activeSlot === 'grenade') {
        document.getElementById('ammo').innerText = inventory.grenade ? 1 : 0;
        document.getElementById('reserve-ammo').innerText = '';
    } else {
        document.getElementById('ammo').innerText = (inventory[activeSlot] && curData.maxAmmo) ? inventory[activeSlot].ammo : '-';
        document.getElementById('reserve-ammo').innerText = (inventory[activeSlot] && curData.maxAmmo) ? `/ ${inventory[activeSlot].reserveAmmo}` : '';
    }
    document.getElementById('weapon-display').innerText = curData.name;
    document.getElementById('armor-bar').style.width = `${armorDurability}%`;
    document.getElementById('helmet-bar').style.width = `${helmetDurability}%`;
    updateCrosshairAndScope();
}

function initGameEngine() {
    preloadWeapons();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.1, 1000);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0); 
    dirLight.position.set(120, 200, 90); 
    scene.add(hemiLight, dirLight);

    buildMapGeometries(scene);

    gunGroup = new THREE.Group();
    camera.add(gunGroup); 
    scene.add(camera);

    build3DWeapon();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.2, 0.4, 0.85));

    setupEvents();
    setupBuyMenuEvents();
}

function shoot() {
    if(isDead || buyMenuOpen) return;
    if (!inventory[activeSlot] || inventory[activeSlot].ammo <= 0) return;
    const now = performance.now(), curKey = getCurrentWeaponKey(), cfg = itemsConfig[curKey];
    if (now - lastShotTime < cfg.fireRate) return;

    lastShotTime = now; inventory[activeSlot].ammo--; updateHUD();
    playShootSound(curKey);

    cameraEuler.x += cfg.recoil || 0.015;
    camera.quaternion.setFromEuler(cameraEuler);
}

function setupEvents() {
    document.addEventListener('mousemove', (e) => {
        if (!pointerLocked || isDead || buyMenuOpen) return;
        const sens = isAiming ? 0.0004 : 0.0016; 
        cameraEuler.y -= e.movementX * sens;
        cameraEuler.x -= e.movementY * sens;
        cameraEuler.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, cameraEuler.x));
        camera.quaternion.setFromEuler(cameraEuler);
    });

    document.addEventListener('keydown', (e) => {
        if (isDead) return;
        if (e.code === 'KeyB') { buyMenuOpen = !buyMenuOpen; buyMenu.classList.toggle('hidden'); if(buyMenuOpen) document.exitPointerLock(); else document.body.requestPointerLock(); }
        if (!pointerLocked || buyMenuOpen) return;
        if (e.code === 'ShiftLeft') isRunning = true;

        switch(e.code) {
            case 'KeyW': moveF = true; break; case 'KeyS': moveB = true; break;
            case 'KeyA': moveL = true; break; case 'KeyD': moveR = true; break;
            case 'Digit1': if (inventory.primary) { activeSlot = 'primary'; build3DWeapon(); updateHUD(); } break;
            case 'Digit2': if (inventory.secondary) { activeSlot = 'secondary'; build3DWeapon(); updateHUD(); } break;
            case 'Digit3': if (inventory.grenade) { activeSlot = 'grenade'; build3DWeapon(); updateHUD(); } break;
            case 'Space': if(canJump) { velocity.y = 8.0; canJump = false; } break;
            case 'KeyR': 
                const curKey = getCurrentWeaponKey();
                if (inventory[activeSlot] && itemsConfig[curKey].maxAmmo) {
                    inventory[activeSlot].ammo = itemsConfig[curKey].maxAmmo; 
                    updateHUD(); 
                    playReloadSound(curKey);
                }
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch(e.code) {
            case 'KeyW': moveF = false; break; case 'KeyS': moveB = false; break;
            case 'KeyA': moveL = false; break; case 'KeyD': moveR = false; break;
            case 'ShiftLeft': isRunning = false; break;
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (buyMenuOpen || isDead) return;
        if (!pointerLocked) { document.body.requestPointerLock(); return; }
        if (e.button === 0) { isMouseDown = true; shoot(); }
        if (e.button === 2) { isAiming = true; updateCrosshairAndScope(); } 
    });
    
    document.addEventListener('mouseup', (e) => { 
        if (e.button === 0) isMouseDown = false;
        if (e.button === 2) { isAiming = false; updateCrosshairAndScope(); } 
    });
}

function setupBuyMenuEvents() {
    Object.keys(itemsConfig).forEach(key => {
        const btn = document.getElementById(`buy-${key}`);
        if (!btn) return;
        btn.onclick = () => {
            const item = itemsConfig[key];
            if (playerMoney >= item.price) {
                playerMoney -= item.price;
                if (key === 'armor') armorDurability = 100;
                else if (key === 'helmet') helmetDurability = 100;
                else if (item.slot) {
                    inventory[item.slot] = { key: key, ammo: item.maxAmmo || 1, reserveAmmo: item.totalAmmo || 0 };
                    activeSlot = item.slot;
                    build3DWeapon();
                }
                updateHUD();
            }
        };
    });
}

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now(), delta = Math.min((time - prevTime) / 1000, 0.1);

    if (!mapLoaded) {
        prevTime = time;
        if (composer && scene && camera) composer.render();
        return;
    }

    if (!window.spawnApplied) {
        camera.position.copy(mapSpawnPoint);
        velocity.set(0, 0, 0); 
        window.spawnApplied = true;
        spawnBots();
    }

    if (pointerLocked && !isDead && !buyMenuOpen) {
        if (isMouseDown && itemsConfig[getCurrentWeaponKey()]?.auto) shoot();

        updateBotLogic(gameMode, isDead, bots, camera, delta, time, takeDamage);

        const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
        const camRight = new THREE.Vector3().crossVectors(camDir, camera.up).normalize();

        velocity.x -= velocity.x * 10.0 * delta; 
        velocity.z -= velocity.z * 10.0 * delta; 
        velocity.y -= 9.8 * 4.5 * delta; 

        let speed = isRunning ? 100 : 60;
        
        if (moveF) { camera.position.x += camDir.x * speed * delta; camera.position.z += camDir.z * speed * delta; }
        if (moveB) { camera.position.x -= camDir.x * speed * delta; camera.position.z -= camDir.z * speed * delta; }
        if (moveL) { camera.position.x -= camRight.x * speed * delta; camera.position.z -= camRight.z * speed * delta; }
        if (moveR) { camera.position.x += camRight.x * speed * delta; camera.position.z += camRight.z * speed * delta; }
        
        camera.position.y += velocity.y * delta;

        // SISTEMA DE DETECÇÃO DE SOLO MELHORADO PARA EVITAR ATRAVESSAR O CHÃO
        downRaycaster.set(camera.position, downVector);
        const hits = downRaycaster.intersectObjects(wallMeshes, false);

        if (hits.length > 0) {
            const groundHit = hits[0];
            const playerEyeHeight = 1.6; 
            
            // fallMargin: Garante que mesmo em alta velocidade o jogo calcule o chão corretamente
            const fallMargin = Math.max(0.5, Math.abs(velocity.y * delta));

            if (groundHit.distance <= playerEyeHeight + fallMargin && velocity.y <= 0) {
                camera.position.y = groundHit.point.y + playerEyeHeight;
                velocity.y = 0;
                canJump = true;
            }
        }

        // Sistema de Resgate (Caso você caia da beirada do mapa, ele te joga de volta)
        if (camera.position.y < -30) {
            camera.position.copy(mapSpawnPoint);
            velocity.set(0, 0, 0);
        }
    }

    prevTime = time;
    if (composer && scene && camera) composer.render(); 
}

btnStart.addEventListener('click', () => {
    playerNick = document.getElementById('player-nick').value || "Striker";
    gameMode = document.querySelector('.mode-btn.active').id === 'mode-bot' ? 'bot' : 'online';
    document.getElementById('lobby-container').style.display = 'none';
    
    window.spawnApplied = false; 
    initGameEngine();
    
    velocity.set(0, 0, 0);
    updateHUD(); 
    animate();
    document.body.requestPointerLock();
});

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    };
});

document.addEventListener('pointerlockchange', () => {
    pointerLocked = !!document.pointerLockElement;
    if (!pointerLocked && !buyMenuOpen && !isDead) pauseScreen.style.display = 'flex'; 
    else pauseScreen.style.display = 'none';
});

document.getElementById('btn-resume').addEventListener('click', () => document.body.requestPointerLock());
document.getElementById('btn-close-buy').addEventListener('click', () => { buyMenuOpen = false; buyMenu.classList.add('hidden'); document.body.requestPointerLock(); });
