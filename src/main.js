import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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

// Sistema 3D de armas
let gunGroup;
let loadedWeapons = {}; // Cache de modelos 3D
let currentWeaponModel = null;
const gltfLoader = new GLTFLoader();

let activeGrenades = [], tracers = [], bots = [], networkPlayers = {}, playerScores = {}; 
const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
let playerBox = new THREE.Box3();

// Multiplayer PeerJS Robusto (Compatível com GitHub Pages HTTPS)
let peer, conn;
let peers = {};
let isHost = false;

const btnStart = document.getElementById('btn-start');
const container = document.getElementById('canvas-container');
const pauseScreen = document.getElementById('pause-screen');
const buyMenu = document.getElementById('buy-menu');
const crosshairElem = document.getElementById('crosshair');
const scopeOverlay = document.getElementById('scope-overlay');
const weaponScales = {
    deagle: { scale: 0.08, pos: new THREE.Vector3(0.15, -0.2, -0.35) },
    p90:    { scale: 0.015, pos: new THREE.Vector3(0.15, -0.2, -0.35) },
    ak47:   { scale: 0.02,  pos: new THREE.Vector3(0.15, -0.2, -0.35) },
    m4a4:   { scale: 0.02,  pos: new THREE.Vector3(0.15, -0.2, -0.35) },
    awp:    { scale: 0.045, pos: new THREE.Vector3(0.15, -0.2, -0.35) }
};

// 1. CARREGAMENTO PRÉVIO DAS ARMAS
function preloadWeapons() {
    const weaponsToLoad = ['ak47', 'm4a4', 'awp', 'deagle', 'p90'];
    weaponsToLoad.forEach(w => {
        gltfLoader.load(`models/${w}.glb`, (gltf) => {
            loadedWeapons[w] = gltf.scene; // Guarda apenas o modelo puro base
        });
    });
}

function getCurrentWeaponKey() { return inventory[activeSlot] ? inventory[activeSlot].key : 'deagle'; }

// 2. LÓGICA DAS MIRAS DINÂMICAS E SCOPE
function updateCrosshairAndScope() {
    const curKey = getCurrentWeaponKey();
    
    if (curKey === 'awp' && isAiming) {
        crosshairElem.style.display = 'none';
        scopeOverlay.style.display = 'block';
        if (currentWeaponModel) currentWeaponModel.visible = false;
        camera.fov = 20; 
    } else if (curKey === 'awp' && !isAiming) {
        crosshairElem.style.display = 'none';
        scopeOverlay.style.display = 'none';
        if (currentWeaponModel) currentWeaponModel.visible = true;
        camera.fov = 78;
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

// 3. TROCA DE MODELO 3D NA MÃO
function build3DWeapon() {
    if (!gunGroup) return;
    
    // Limpa a mão do jogador
    while(gunGroup.children.length > 0) {
        gunGroup.remove(gunGroup.children[0]);
    }
    currentWeaponModel = null;
    
    const curKey = getCurrentWeaponKey();
    const config = weaponScales[curKey] || { scale: 0.03, pos: new THREE.Vector3(0.15, -0.2, -0.35) };

    if (activeSlot === 'grenade') {
        const nade = new THREE.Mesh(new THREE.SphereGeometry(0.08), new THREE.MeshStandardMaterial({color: 0x2e3d29}));
        nade.position.copy(config.pos);
        gunGroup.add(nade);
        currentWeaponModel = nade;
    } else if (loadedWeapons[curKey]) {
        // Clona de forma limpa direto para dentro do grupo da câmera
        const wpnClone = loadedWeapons[curKey].clone(true);
        
        wpnClone.scale.set(config.scale, config.scale, config.scale); 
        wpnClone.position.copy(config.pos); 
        wpnClone.rotation.set(0, Math.PI, 0); 

        gunGroup.add(wpnClone);
        currentWeaponModel = wpnClone;
    } else {
        const placeholder = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.5), new THREE.MeshBasicMaterial({color: 0x555555}));
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
    scene.add(hemiLight, dirLight);

    buildMapGeometries(scene);

    gunGroup = new THREE.Group();
    camera.add(gunGroup); 
    scene.add(camera);

    setTimeout(build3DWeapon, 1000);

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

// 4. FIX DO MULTIPLAYER (FORÇANDO HTTPS E PORTA 443 PARA GITHUB PAGES)
function initMultiplayer() {
    const roomId = document.getElementById('room-id').value || "dust2-server";
    const myId = playerNick + "_" + Math.floor(Math.random() * 10000);
    
    peer = new Peer(myId, {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        debug: 1
    });

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
            case 'KeyR': inventory[activeSlot].ammo = itemsConfig[getCurrentWeaponKey()].maxAmmo; updateHUD(); break;
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
        document.getElementById(`buy-${w}`).onclick = () => {
            const item = itemsConfig[w];
            if (playerMoney >= item.price) {
                playerMoney -= item.price;
                inventory[item.slot] = { key: w, ammo: item.maxAmmo, reserveAmmo: item.totalAmmo };
                activeSlot = item.slot;
                build3DWeapon(); updateHUD();
            }
        };
    });
}

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now(), delta = Math.min((time - prevTime) / 1000, 0.1);
// F8 = mostra a posição atual do jogador
if (!window.debugSpawn) {

    window.debugSpawn = true;

    document.addEventListener("keydown", (e) => {

        if (e.code === "F8") {

            console.clear();

            console.log(
                `mapSpawnPoint.set(${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)});`
            );

        }

    });

}
    // Aplica o spawn do mapa configurado no map.js assim que ele carrega
    if (mapLoaded && mapSpawnPoint && !window.spawnApplied) {
        camera.position.copy(mapSpawnPoint);
        window.spawnApplied = true;
    }

    if (pointerLocked && !isDead && !buyMenuOpen) {
        if (isMouseDown && itemsConfig[getCurrentWeaponKey()].auto) shoot();

        const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
        const camRight = new THREE.Vector3().crossVectors(camDir, camera.up).normalize();

        velocity.x -= velocity.x * 10.0 * delta; velocity.z -= velocity.z * 10.0 * delta; velocity.y -= 9.8 * 4.2 * delta;

        let speed = isRunning ? 115 : 68;
        if (moveF) velocity.addScaledVector(camDir, speed * delta);
        if (moveB) velocity.addScaledVector(camDir, -speed * delta);
        if (moveL) velocity.addScaledVector(camRight, -speed * delta);
        if (moveR) velocity.addScaledVector(camRight, speed * delta);

        const oldPos = camera.position.clone();
        camera.position.x += velocity.x * delta; 
        camera.position.z += velocity.z * delta;
        camera.position.y += velocity.y * delta;

        playerBox.setFromCenterAndSize(camera.position, new THREE.Vector3(0.6, 1.8, 0.6));

        if (time > 1000) {
            for (let box of collidables) {
                if (playerBox.intersectsBox(box)) {
                    // Se estiver caindo e tocar em cima de um bloco/piso, aterrissa nele
                    if (velocity.y < 0 && oldPos.y >= box.max.y - 0.2) {
                        camera.position.y = box.max.y + 0.9; 
                        velocity.y = 0;
                        canJump = true;
                        break;
                    } 
                    // Se estiver subindo/pulando, IGNORA o teto completamente para nunca prender lá em cima
                    else if (velocity.y > 0) {
                        // Não faz nada, deixa passar direto pelo teto
                    } 
                    else {
                        // Colisão apenas com paredes nas laterais
                        camera.position.x = oldPos.x; 
                        camera.position.z = oldPos.z; 
                        break; 
                    }
                }
            }
        }

        // Segurança caso caia no void
        if (camera.position.y < -30) { 
            camera.position.copy(mapSpawnPoint || new THREE.Vector3(0, 15, 0)); 
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
    
    window.spawnApplied = false; // Permite aplicar o novo spawn do mapa
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
