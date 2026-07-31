// src/main.js
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { itemsConfig, safeSpawns } from './config.js';
import { playShootSound, playExplosionSound, playReloadSound } from './audio.js';
import { buildMapGeometries, wallMeshes, mapWallMeshes, mapSpawnPoint, mapLoaded } from './map.js';
import { updateBotLogic, spawnBots } from './bot.js';

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
let mixer = null; 
const gltfLoader = new GLTFLoader();

let bots = [];
let activeGrenades = [], tracers = [], networkPlayers = {}, playerScores = {}; 
const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
let playerBox = new THREE.Box3();

const downRaycaster = new THREE.Raycaster();
const downVector = new THREE.Vector3(0, -1, 0);

// --- MULTIPLAYER GLOBAL VARS & CONFIG ---
let peer, conn;
let peers = {};
let isHost = false;

const PEER_CONFIG = {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    path: '/',
    debug: 2
};

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

// --- AUTO-DETECT ROOM VIA URL PARAMETER (?room=...) ---
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    
    if (roomParam) {
        const roomInput = document.getElementById('room-id');
        if (roomInput) roomInput.value = roomParam;
        
        const onlineBtn = document.getElementById('mode-online');
        if (onlineBtn) onlineBtn.click();
    }
});

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

        if (weaponData.animations && weaponData.animations.length > 0) {
            mixer = new THREE.AnimationMixer(wpnClone);
            const action = mixer.clipAction(weaponData.animations[0]);
            action.setLoop(THREE.LoopOnce, 1);
            action.repetitions = 1;
            action.clampWhenFinished = true;
            action.setDuration(2.2);
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
    camera.position.copy(mapSpawnPoint);

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

// --- MULTIPLAYER COM SUPORTE A LINK DIRETO ---
function initMultiplayer() {
    const roomId = document.getElementById('room-id').value.trim() || "dust2-server";
    const myId = playerNick.replace(/[^a-zA-Z0-9]/g, '') + "_" + Math.floor(Math.random() * 10000);
    
    peer = new Peer(myId, PEER_CONFIG);

    peer.on('open', (id) => {
        document.getElementById('kill-feed').innerText = "Procurando sala...";
        document.getElementById('kill-feed').style.display = 'block';
        
        const hostId = "host_" + roomId;
        if (id === hostId) {
            setupAsHost();
            return;
        }

        conn = peer.connect(hostId, { reliable: true });
        
        conn.on('open', () => {
            document.getElementById('kill-feed').innerText = "Conectado à sala com sucesso!";
            peers[hostId] = conn;
            conn.send({ type: 'join', id: peer.id, nick: playerNick });
        });

        conn.on('data', handleNetworkData);
        
        conn.on('error', (err) => {
            console.error("Erro na conexão com o host:", err);
            setupAsHost();
        });
    });

    peer.on('error', (err) => {
        console.error("Erro geral no PeerJS:", err);
        if (err.type === 'unavailable-id') {
            document.getElementById('kill-feed').innerText = "Sala já existe. Entrando como jogador...";
        }
    });

    peer.on('connection', (incomingConn) => {
        incomingConn.on('open', () => {
            peers[incomingConn.peer] = incomingConn;
        });
        incomingConn.on('data', (data) => {
            handleNetworkData(data, incomingConn.peer);
            
            if (isHost) {
                Object.keys(peers).forEach(peerId => {
                    if (peerId !== incomingConn.peer && peers[peerId] && peers[peerId].open) {
                        peers[peerId].send(data);
                    }
                });
            }
        });
        incomingConn.on('close', () => {
            removeNetworkPlayer(incomingConn.peer);
            delete peers[incomingConn.peer];
        });
    });
}

function setupAsHost() {
    isHost = true;
    const roomId = document.getElementById('room-id').value.trim() || "dust2-server";
    
    if (peer) peer.destroy();
    
    const hostId = "host_" + roomId;
    peer = new Peer(hostId, PEER_CONFIG);

    peer.on('open', () => {
        const baseUrl = window.location.origin + window.location.pathname;
        const roomLink = `${baseUrl}?room=${roomId}`;
        
        // Copia automaticamente o link da sala para facilitar o envio aos amigos
        navigator.clipboard?.writeText(roomLink).catch(() => {});

        document.getElementById('kill-feed').innerText = "Sala criada! Link copiado para a área de transferência. Aguardando amigos...";
        document.getElementById('kill-feed').style.display = 'block';
    });

    peer.on('connection', (incomingConn) => {
        incomingConn.on('open', () => {
            peers[incomingConn.peer] = incomingConn;
        });

        incomingConn.on('data', (data) => {
            handleNetworkData(data, incomingConn.peer);
            
            Object.keys(peers).forEach(peerId => {
                if (peerId !== incomingConn.peer && peers[peerId] && peers[peerId].open) {
                    peers[peerId].send(data);
                }
            });
        });

        incomingConn.on('close', () => {
            removeNetworkPlayer(incomingConn.peer);
            delete peers[incomingConn.peer];
        });
    });
}

function handleNetworkData(data, senderId) {
    if (data.type === 'pos') {
        let netPlayer = networkPlayers[data.id];
        if (!netPlayer) {
            netPlayer = createNetworkPlayer(data.id, data.nick || "Amigo");
        }
        netPlayer.position.lerp(new THREE.Vector3(data.x, data.y, data.z), 0.3);
        netPlayer.rotation.y = data.rot;
    } else if (data.type === 'shoot') {
        playShootSound();
    } else if (data.type === 'player_died') {
        console.log(`Jogador ${data.id} foi eliminado por ${data.killer}`);
    } else if (data.type === 'hit') {
        if (data.targetId === peer.id) {
            damagePlayer(data.damage, data.attackerNick, data.weapon);
        }
    }
}

function sendNetworkData() {
    if (!peer || gameMode !== 'online') return;
    const posData = { 
        type: 'pos', 
        id: peer.id, 
        nick: playerNick,
        x: camera.position.x, 
        y: camera.position.y - 0.75, 
        z: camera.position.z, 
        rot: cameraEuler.y 
    };
    
    Object.values(peers).forEach(c => { 
        if (c && c.open) c.send(posData); 
    });
}

function createNetworkPlayer(id, nick) {
    if (networkPlayers[id]) return networkPlayers[id];

    const g = new THREE.Group();
    const torso = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 1.5, 0.4), 
        new THREE.MeshStandardMaterial({ color: 0x3366cc })
    );
    torso.position.y = 0.75;
    g.add(torso);
    scene.add(g);
    
    networkPlayers[id] = g;
    return g;
}

function removeNetworkPlayer(id) {
    if (networkPlayers[id]) {
        scene.remove(networkPlayers[id]);
        delete networkPlayers[id];
    }
}

// --- SISTEMA DE DANO, MORTE E RESPAWN AUTOMÁTICO ---
function damagePlayer(amount, killerName = "Inimigo", weaponName = "Arma") {
    if (isDead) return;
    hp -= amount;
    updateHUD();
    
    if (hp <= 0) {
        triggerDeath(killerName, weaponName);
    }
}

function triggerDeath(killerName, weaponName) {
    isDead = true;
    document.exitPointerLock();

    Object.values(peers).forEach(c => {
        if (c && c.open) c.send({ type: 'player_died', id: peer ? peer.id : 'local', killer: killerName });
    });

    let deathScreen = document.getElementById('death-screen');
    if (!deathScreen) {
        deathScreen = document.createElement('div');
        deathScreen.id = 'death-screen';
        deathScreen.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(150,0,0,0.5);display:flex;flex-direction:column;justify-content:center;align-items:center;color:white;font-family:sans-serif;z-index:9999;';
        document.body.appendChild(deathScreen);
    }
    
    deathScreen.innerHTML = `
        <h1 style="font-size: 3rem; margin: 0 0 10px 0;">VOCÊ MORREU</h1>
        <p style="font-size: 1.5rem; margin: 0;">Morto por: <strong>${killerName}</strong> (${weaponName})</p>
        <p style="font-size: 1.2rem; margin: 10px 0 0 0; color: #ffcccb;">Respawn em 5 segundos...</p>
    `;
    deathScreen.style.display = 'flex';

    setTimeout(() => {
        respawnPlayer();
    }, 5000);
}

function respawnPlayer() {
    isDead = false;
    hp = 100;
    
    const deathScreen = document.getElementById('death-screen');
    if (deathScreen) deathScreen.style.display = 'none';

    if (mapSpawnPoint) {
        camera.position.set(mapSpawnPoint.x, mapSpawnPoint.y + 0.75, mapSpawnPoint.z);
    }
    velocity.set(0, 0, 0);
    updateHUD();
    
    document.body.requestPointerLock();
}

function shoot() {
    if(isDead || buyMenuOpen) return;
    if (activeSlot === 'grenade') { inventory.grenade = null; activeSlot = 'secondary'; build3DWeapon(); return; }
    
    if (!inventory[activeSlot] || inventory[activeSlot].ammo <= 0) return;
    const now = performance.now(), curKey = getCurrentWeaponKey(), cfg = itemsConfig[curKey];
    if (now - lastShotTime < cfg.fireRate) return;

    lastShotTime = now; inventory[activeSlot].ammo--; updateHUD();
    playShootSound(curKey);

    if(curKey !== 'awp') {
        crosshairElem.style.transform = "translate(-50%, -50%) scale(1.5)";
        setTimeout(() => crosshairElem.style.transform = "translate(-50%, -50%) scale(1)", 150);
    }

    if (gameMode === 'online') { 
        Object.values(peers).forEach(c => { if (c && c.open) c.send({ type: 'shoot' }); }); 
    }

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
            case 'Space': 
                if(canJump) { 
                    velocity.y = 6.5; 
                    canJump = false; 
                } 
                break;
            case 'KeyR': 
                const curKey = getCurrentWeaponKey();
                inventory[activeSlot].ammo = itemsConfig[curKey].maxAmmo; 
                updateHUD(); 
                playReloadSound(curKey);
                
                if (mixer && loadedWeapons[curKey]?.animations.length > 0) {
                    mixer.stopAllAction();
                    const action = mixer.clipAction(loadedWeapons[curKey].animations[0]);
                    action.reset();
                    action.setLoop(THREE.LoopOnce, 1);
                    action.repetitions = 1;
                    action.clampWhenFinished = true;
                    action.setDuration(3.0);
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

    if (mixer) mixer.update(delta);

    const playerWidth = 0.8;
    const playerHeight = 1.5;

    if (mapLoaded && mapSpawnPoint && !window.spawnApplied) {
        camera.position.set(mapSpawnPoint.x, mapSpawnPoint.y + (playerHeight / 2), mapSpawnPoint.z);
        velocity.set(0, 0, 0); 
        window.spawnApplied = true;

        if (gameMode === 'bot' && bots.length === 0) {
            const botSpawns = [
                new THREE.Vector3(mapSpawnPoint.x + 5, mapSpawnPoint.y, mapSpawnPoint.z + 5),
                new THREE.Vector3(mapSpawnPoint.x - 5, mapSpawnPoint.y, mapSpawnPoint.z + 8),
                new THREE.Vector3(mapSpawnPoint.x + 8, mapSpawnPoint.y, mapSpawnPoint.z - 5)
            ];
            spawnBots(scene, bots, botSpawns);
        }
    }

    if (pointerLocked && !isDead && !buyMenuOpen) {
        if (isMouseDown && itemsConfig[getCurrentWeaponKey()].auto) shoot();

        const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
        const camRight = new THREE.Vector3().crossVectors(camDir, camera.up).normalize();

        velocity.x -= velocity.x * 10.0 * delta; 
        velocity.z -= velocity.z * 10.0 * delta; 
        velocity.y -= 9.8 * 3.5 * delta; 

        let speed = isRunning ? 10 : 6;
        
        let moveDir = new THREE.Vector3();
        if (moveF) moveDir.add(camDir);
        if (moveB) moveDir.sub(camDir);
        if (moveL) moveDir.sub(camRight);
        if (moveR) moveDir.add(camRight);
        moveDir.y = 0;
        
        if (moveDir.lengthSq() > 0) {
            moveDir.normalize();
        }

        if (moveDir.lengthSq() > 0 && wallMeshes && wallMeshes.length > 0) {
            const raycaster = new THREE.Raycaster(camera.position, moveDir, 0, 0.7);
            const intersects = raycaster.intersectObjects(wallMeshes, false);

            if (intersects.length === 0 || intersects[0].distance > 0.5) {
                camera.position.addScaledVector(moveDir, speed * delta);
            }
        } else if (moveDir.lengthSq() > 0) {
            camera.position.addScaledVector(moveDir, speed * delta);
        }

        camera.position.y += velocity.y * delta;

        canJump = false;
        let grounded = false;

        if (wallMeshes && wallMeshes.length > 0) {
            const downRay = new THREE.Raycaster(camera.position, new THREE.Vector3(0, -1, 0), 0, (playerHeight / 2) + 0.2);
            const floorIntersects = downRay.intersectObjects(wallMeshes, false);

            if (floorIntersects.length > 0 && velocity.y <= 0) {
                const hit = floorIntersects[0];
                const groundY = hit.point.y + (playerHeight / 2);
                
                if (camera.position.y <= groundY + 0.1) {
                    camera.position.y = groundY;
                    velocity.y = 0;
                    canJump = true;
                    grounded = true;
                }
            }
        }

        const fallbackGround = mapSpawnPoint ? mapSpawnPoint.y : 0;
        const currentFeet = camera.position.y - (playerHeight / 2);
        if (!grounded && currentFeet <= fallbackGround && velocity.y <= 0) {
            camera.position.y = fallbackGround + (playerHeight / 2);
            velocity.y = 0;
            canJump = true;
        }

        if (camera.position.y < fallbackGround - 50) { 
            camera.position.set(mapSpawnPoint.x, mapSpawnPoint.y + (playerHeight / 2), mapSpawnPoint.z);
            velocity.set(0, 0, 0);
        }
    
        if (cameraEuler.x > 0 && !isMouseDown) { 
            cameraEuler.x = Math.max(0, cameraEuler.x - delta * 0.5); 
            camera.quaternion.setFromEuler(cameraEuler); 
        }

        updateBotLogic(gameMode, isDead, bots, camera, delta, time, (damageAmount) => {
            damagePlayer(damageAmount, "Bot Combatente", "Rifle IA");
        });

        sendNetworkData();
    }

    prevTime = time;
    if (composer && scene && camera) composer.render(); 
}

btnStart.addEventListener('click', () => {
    playerNick = document.getElementById('player-nick').value || "Striker";
    gameMode = document.querySelector('.mode-btn.active').id === 'mode-bot' ? 'bot' : 'online';
    document.getElementById('lobby-container').style.display = 'none';
    
    document.getElementById('hud-bottom-left').style.display = 'flex';
    document.getElementById('hud-bottom-right').style.display = 'flex';
    document.getElementById('buy-hint').style.display = 'block';
    
    bots.length = 0; 
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
