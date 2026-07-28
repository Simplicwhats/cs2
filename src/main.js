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
const slotOrder = ['primary', 'secondary', 'grenade'];
let activeSlot = 'secondary';
let armorDurability = 0, helmetDurability = 0;

let lastShotTime = 0, isAiming = false, pointerLocked = false, buyMenuOpen = false, isMouseDown = false;
let scene, camera, renderer, composer, prevTime = performance.now();
let moveF = false, moveB = false, moveL = false, moveR = false, canJump = true;
let isRunning = false, isCrouching = false;
let velocity = new THREE.Vector3();
let hp = 100, isDead = false;

let gunGroup;
let loadedWeapons = {}; 
let currentWeaponModel = null;
let mixer = null; // Mixer do Three.js para as animações
const gltfLoader = new GLTFLoader();

let activeGrenades = [], tracers = [], bots = [], networkPlayers = {}, playerScores = {}; 
const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
let playerBox = new THREE.Box3();

let peer, conn;
let peers = {};
let isHost = false;

const btnStart = document.getElementById('btn-start');
const container = document.getElementById('canvas-container');
const pauseScreen = document.getElementById('pause-screen');
const buyMenu = document.getElementById('buy-menu');
const crosshairElem = document.getElementById('crosshair');
const scopeOverlay = document.getElementById('scope-overlay');

// ESCALAS E POSIÇÕES CORRIGIDAS E CENTRALIZADAS (X = 0)
const weaponScales = {
    deagle: { scale: 0.008, pos: new THREE.Vector3(0, -0.15, -0.35) }, 
    p90:    { scale: 0.002, pos: new THREE.Vector3(0, -0.15, -0.35) }, 
    ak47:   { scale: 0.003, pos: new THREE.Vector3(0, -0.15, -0.35) }, 
    m4a4:   { scale: 0.003, pos: new THREE.Vector3(0, -0.15, -0.35) }, 
    awp:    { scale: 0.002, pos: new THREE.Vector3(0, -0.15, -0.35) }  
};

function preloadWeapons() {
    const weaponsToLoad = ['ak47', 'm4a4', 'awp', 'deagle', 'p90'];
    weaponsToLoad.forEach(w => {
        gltfLoader.load(`models/${w}.glb`, (gltf) => {
            const model = gltf.scene;
            model.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.needsUpdate = true;
                }
            });
            
            // Salva o modelo e as animações embutidas
            loadedWeapons[w] = {
                scene: model,
                animations: gltf.animations
            }; 
            
            if (w === getCurrentWeaponKey()) {
                build3DWeapon();
            }
        }, undefined, (err) => {
            console.error(`ERRO ao carregar ${w}.glb:`, err);
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
        
        if (curKey === 'deagle' || curKey === 'p90') {
            crosshairElem.className = 'crosshair-small';
        } else {
            crosshairElem.className = 'crosshair-standard';
        }
        
        camera.fov = (isAiming && itemsConfig[curKey].zoomFov) ? itemsConfig[curKey].zoomFov : 78;
    }
    camera.updateProjectionMatrix();
}

function build3DWeapon() {
    if (!gunGroup) return;
    
    while(gunGroup.children.length > 0) {
        gunGroup.remove(gunGroup.children[0]);
    }
    currentWeaponModel = null;
    mixer = null; 
    
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

        // Configura o Mixer, mas NÃO deixa em loop infinito
        if (weaponData.animations && weaponData.animations.length > 0) {
            mixer = new THREE.AnimationMixer(wpnClone);
            const action = mixer.clipAction(weaponData.animations[0]);
            
            // Faz a animação tocar apenas uma vez e parar no último frame
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            
            // Se quiser que ela toque ao equipar a arma, descomente a linha abaixo:
            // action.play();
        }
    } else {
        const placeholder = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.6), new THREE.MeshBasicMaterial({color: 0x555555}));
        placeholder.position.copy(config.pos);
        gunGroup.add(placeholder);
        currentWeaponModel = placeholder;
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
        document.getElementById('ammo').innerText = curData.maxAmmo ? inventory[activeSlot].ammo : '-';
        document.getElementById('reserve-ammo').innerText = curData.maxAmmo ? `/ ${inventory[activeSlot].reserveAmmo}` : '';
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
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.002);

    camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.8, 0);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5); 
    dirLight.position.set(120, 200, 90); 
    const ambientLight = new THREE.AmbientLight(0x404040, 1.5); 
    scene.add(hemiLight, dirLight, ambientLight);

    buildMapGeometries(scene);

    gunGroup = new THREE.Group();
    camera.add(gunGroup); 
    scene.add(camera);

    build3DWeapon();

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    
    container.innerHTML = '';
    container.style.display = 'block'; 
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.appendChild(renderer.domElement);
    
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.25, 0.4, 0.85);
    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    setupEvents();
    setupBuyMenuEvents();

    if (gameMode === 'online') initMultiplayer();
}

function initMultiplayer() {
    const roomId = document.getElementById('room-id').value || "dust2-server";
    const myId = playerNick + "_" + Math.floor(Math.random() * 10000);
    
    peer = new Peer(myId, { host: '0.peerjs.com', port: 443, secure: true, debug: 1 });

    peer.on('open', (id) => {
        document.getElementById('kill-feed').innerText = "Buscando servidor...";
        document.getElementById('kill-feed').style.display = 'block';
        
        conn = peer.connect("host_" + roomId);
        
        conn.on('open', () => {
            document.getElementById('kill-feed').innerText = "Conectado ao Host!";
            conn.send({ type: 'join', nick: playerNick });
        });

        conn.on('error', () => {
            isHost = true;
            peer.destroy();
            peer = new Peer("host_" + roomId, { host: '0.peerjs.com', port: 443, secure: true });
            peer.on('open', () => { document.getElementById('kill-feed').innerText = "Servidor Criado. Aguardando jogadores..."; });
            peer.on('connection', handleIncomingConnection);
        });
    });

    peer.on('connection', handleIncomingConnection);
}

function handleIncomingConnection(connection) {
    peers[connection.peer] = connection;
    createNetworkPlayer(connection.peer, "Inimigo"); 
    
    connection.on('data', (data) => {
        if (data.type === 'pos') {
            const netPlayer = networkPlayers[connection.peer];
            if (netPlayer) {
                netPlayer.position.lerp(new THREE.Vector3(data.x, data.y, data.z), 0.3);
                netPlayer.rotation.y = data.rot;
            }
        }
        if (data.type === 'shoot') playShootSound();
    });
}

function sendNetworkData() {
    if (!peer || gameMode !== 'online') return;
    const posData = { type: 'pos', x: camera.position.x, y: camera.position.y - 0.8, z: camera.position.z, rot: cameraEuler.y };
    Object.values(peers).forEach(c => { if (c.open) c.send(posData); });
}

function createNetworkPlayer(id, nick) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.4), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
    torso.position.y = 0.75;
    g.add(torso);
    scene.add(g);
    networkPlayers[id] = g;
}

function shoot() {
    if(isDead || buyMenuOpen) return;
    if (activeSlot === 'grenade') { inventory.grenade = null; activeSlot = 'secondary'; build3DWeapon(); return; }
    
    if (!inventory[activeSlot] || inventory[activeSlot].ammo <= 0) return;
    const now = performance.now(), curKey = getCurrentWeaponKey(), cfg = itemsConfig[curKey];
    if (now - lastShotTime < cfg.fireRate) return;

    lastShotTime = now; inventory[activeSlot].ammo--; updateHUD();
    playShootSound();

    if(curKey !== 'awp') {
        crosshairElem.style.transform = "translate(-50%, -50%) scale(1.5)";
        setTimeout(() => crosshairElem.style.transform = "translate(-50%, -50%) scale(1)", 150);
    }

    if (gameMode === 'online') { Object.values(peers).forEach(c => { if (c.open) c.send({ type: 'shoot' }); }); }

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
            case 'Space': if(canJump) { velocity.y = 8.5; canJump = false; } break;
            case 'KeyR': 
    inventory[activeSlot].ammo = itemsConfig[getCurrentWeaponKey()].maxAmmo; 
    updateHUD(); 
    playReloadSound();
    
    // Toca a animação do GLB ao recarregar
    if (mixer && loadedWeapons[getCurrentWeaponKey()]?.animations.length > 0) {
        mixer.stopAllAction();
        const action = mixer.clipAction(loadedWeapons[getCurrentWeaponKey()].animations[0]);
        action.reset();
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
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
    ['deagle', 'p90', 'ak47', 'm4a4', 'awp'].forEach(w => {
        const btn = document.getElementById(`buy-${w}`);
        if (btn) {
            btn.onclick = () => {
                const item = itemsConfig[w];
                if (playerMoney >= item.price) {
                    playerMoney -= item.price;
                    inventory[item.slot] = { key: w, ammo: item.maxAmmo, reserveAmmo: item.totalAmmo };
                    activeSlot = item.slot;
                    build3DWeapon(); 
                    updateHUD();
                }
            };
        }
    });
}

if (!window.debugSpawn) {
    window.debugSpawn = true;
    document.addEventListener("keydown", (e) => {
        if (e.code === "F8") {
            console.clear();
            console.log(`mapSpawnPoint.set(${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)});`);
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now(), delta = Math.min((time - prevTime) / 1000, 0.1);

    // Atualiza o mixer de animação do modelo 3D
    if (mixer) mixer.update(delta);

    if (mapLoaded && mapSpawnPoint && !window.spawnApplied) {
        camera.position.copy(mapSpawnPoint);
        velocity.set(0, 0, 0); 
        window.spawnApplied = true;
    }

    if (pointerLocked && !isDead && !buyMenuOpen) {
        if (isMouseDown && itemsConfig[getCurrentWeaponKey()].auto) shoot();

        const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
        const camRight = new THREE.Vector3().crossVectors(camDir, camera.up).normalize();

        velocity.x -= velocity.x * 10.0 * delta; velocity.z -= velocity.z * 10.0 * delta; velocity.y -= 9.8 * 4.2 * delta;

        let speed = isRunning ? 115 : 68;
        
        const proposedPos = camera.position.clone();
        if (moveF) { proposedPos.x += camDir.x * speed * delta; proposedPos.z += camDir.z * speed * delta; }
        if (moveB) { proposedPos.x -= camDir.x * speed * delta; proposedPos.z -= camDir.z * speed * delta; }
        if (moveL) { proposedPos.x -= camRight.x * speed * delta; proposedPos.z -= camRight.z * speed * delta; }
        if (moveR) { proposedPos.x += camRight.x * speed * delta; proposedPos.z += camRight.z * speed * delta; }
        
        proposedPos.y += velocity.y * delta;

        playerBox.setFromCenterAndSize(proposedPos, new THREE.Vector3(0.6, 1.8, 0.6));
        
        let canMoveX = true, canMoveZ = true;

        if (time > 1000) {
            for (let box of collidables) {
                if (playerBox.intersectsBox(box)) {
                    const distToTop = box.max.y - (camera.position.y - 0.9);
                    
                    if (velocity.y < 0 && distToTop >= 0 && distToTop < 1.5) {
                        proposedPos.y = box.max.y + 0.9; 
                        velocity.y = 0;
                        canJump = true;
                    } else if (velocity.y > 0 && camera.position.y <= box.min.y) {
                        velocity.y = -1;
                    } else {
                        const testBoxX = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(proposedPos.x, camera.position.y, camera.position.z), new THREE.Vector3(0.6, 1.8, 0.6));
                        if (testBoxX.intersectsBox(box)) canMoveX = false;
                        
                        const testBoxZ = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(camera.position.x, camera.position.y, proposedPos.z), new THREE.Vector3(0.6, 1.8, 0.6));
                        if (testBoxZ.intersectsBox(box)) canMoveZ = false;
                    }
                }
            }
        }

        if (canMoveX) camera.position.x = proposedPos.x;
        if (canMoveZ) camera.position.z = proposedPos.z;
        camera.position.y = proposedPos.y;

        if (camera.position.y < mapSpawnPoint.y - 50) { 
            camera.position.copy(mapSpawnPoint); 
            velocity.set(0, 0, 0);
        }
    
        if (cameraEuler.x > 0 && !isMouseDown) { 
            cameraEuler.x = Math.max(0, cameraEuler.x - delta * 0.5); 
            camera.quaternion.setFromEuler(cameraEuler); 
        }

        sendNetworkData();
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
    updateHUD(); animate();
    document.body.requestPointerLock();
});

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('net-link-section').style.display = btn.id === 'mode-online' ? 'block' : 'none';
    };
});

document.addEventListener('pointerlockchange', () => {
    pointerLocked = !!document.pointerLockElement;
    if (!pointerLocked && !buyMenuOpen && !isDead) pauseScreen.style.display = 'flex'; 
    else pauseScreen.style.display = 'none';
});

document.getElementById('btn-resume').addEventListener('click', () => document.body.requestPointerLock());
document.getElementById('btn-close-buy').addEventListener('click', () => { buyMenuOpen = false; buyMenu.classList.add('hidden'); document.body.requestPointerLock(); });
