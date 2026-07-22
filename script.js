let gameMode = 'bot';
let maxClients = 0; 
let peer, isHost = true;
let hostConns = []; 
let myConn = null;  
let networkPlayers = {}; 
let playerScores = {}; 
let playerNick = "Striker", selectedMap = "dust2";
let playerMoney = 5000;
let activeGrenades = [];

// Duplo Clique no W para Correr
let lastWPressTime = 0;

// Configuração de Áudio Procedural
let audioCtx = null;
function playShootSound() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const bufferSize = audioCtx.sampleRate * 0.3;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, audioCtx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.25);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(1.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        noise.start();
        noise.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
}

function playExplosionSound() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const bufferSize = audioCtx.sampleRate * 1.5;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, audioCtx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 1.2);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(3.0, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        noise.start();
        noise.stop(audioCtx.currentTime + 1.4);
    } catch (e) {}
}

function playReloadSound() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(350, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(90, audioCtx.currentTime + 0.2);
        
        gain.gain.setValueAtTime(0.6, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
}

const itemsConfig = {
    deagle: { name: "Desert Eagle", damage: 60, fireRate: 350, maxAmmo: 7, totalAmmo: 35, spread: 0.008, recoil: 0.015, price: 700, auto: false, slot: 'secondary' },
    p90:    { name: "P90", damage: 22, fireRate: 80, maxAmmo: 50, totalAmmo: 100, spread: 0.012, recoil: 0.005, price: 2350, auto: true, slot: 'primary' },
    ak47:   { name: "AK-47", damage: 36, fireRate: 110, maxAmmo: 30, totalAmmo: 90, spread: 0.008, recoil: 0.010, price: 2700, auto: true, slot: 'primary' },
    m4a4:   { name: "M4A4", damage: 28, fireRate: 95, maxAmmo: 30, totalAmmo: 90, spread: 0.006, recoil: 0.007, price: 3100, auto: true, slot: 'primary' },
    awp:    { name: "AWP", damage: 115, fireRate: 1300, maxAmmo: 5, totalAmmo: 30, spread: 0.001, recoil: 0.030, price: 4750, zoomFov: 20, auto: false, slot: 'primary' },
    armor:  { name: "Colete Balístico", price: 650, type: 'gear' },
    helmet: { name: "Capacete", price: 350, type: 'gear' },
    grenade:{ name: "Granada HE", price: 300, type: 'gear', maxAmmo: 1 }
};

let inventory = {
    secondary: { key: 'deagle', ammo: 7, reserveAmmo: 35 },
    primary: null
};
let activeSlot = 'secondary';
let hasArmor = false, hasHelmet = false, grenadesCount = 0;

let lastShotTime = 0, isAiming = false, pointerLocked = false, buyMenuOpen = false, isMouseDown = false;
let isInvulnerable = false, invulnerableTimeout = null;
let lastKillerPos = null;

const btnStart = document.getElementById('btn-start');
const container = document.getElementById('canvas-container');
const pauseScreen = document.getElementById('pause-screen');
const buyMenu = document.getElementById('buy-menu');

// Zonas seguras na rua sem interseção com prédios
const safeSpawns = [
    {x: 0, z: 0}, {x: 30, z: 0}, {x: -30, z: 0}, {x: 0, z: 30}, {x: 0, z: -30},
    {x: 50, z: 50}, {x: -50, z: -50}, {x: 50, z: -50}, {x: -50, z: 50}
];

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('room')) {
    isHost = false; gameMode = 'client'; maxClients = 0;
    document.getElementById('mode-2v2').classList.add('active');
    document.getElementById('mode-bot').classList.remove('active');
    document.getElementById('net-link-section').style.display = 'block';
    document.getElementById('net-status-label').innerText = "Conectado! Aguardando o Host iniciar...";
    btnStart.innerText = "AGUARDANDO O HOST...";
    btnStart.disabled = true;
    initClient(urlParams.get('room'));
} else {
    initHost();
}

function setGameMode(mode) {
    if (!isHost && mode !== 'bot') return;
    gameMode = mode;
    isHost = true;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('mode-' + mode).classList.add('active');
    
    if (mode === 'bot') {
        maxClients = 0;
        document.getElementById('net-link-section').style.display = 'none';
        btnStart.disabled = false;
        btnStart.innerText = "INICIAR PARTIDA";
    } else {
        maxClients = mode === '1v1' ? 1 : 2; // 2 clientes + host = 3 players
        document.getElementById('net-link-section').style.display = 'block';
        updateLobbyStatus();
    }
}

function initHost() {
    const room = Math.random().toString(36).substring(2, 8);
    peer = new Peer(room, { host: '0.peerjs.com', port: 443, path: '/', secure: true });
    peer.on('open', () => { document.getElementById('lobby-link').value = `${window.location.href.split('?')[0]}?room=${room}`; });
    peer.on('connection', (c) => {
        if (hostConns.length >= maxClients) { c.close(); return; }
        hostConns.push(c);
        c.on('data', (d) => handleData(c.peer, d));
        c.on('open', () => { updateLobbyStatus(); });
        c.on('close', () => {
            hostConns = hostConns.filter(conn => conn !== c);
            delete playerScores[c.peer];
            updateLobbyStatus();
            updateScoreboard();
        });
    });
}

function initClient(targetRoom) {
    peer = new Peer({ host: '0.peerjs.com', port: 443, path: '/', secure: true });
    peer.on('open', () => {
        myConn = peer.connect(targetRoom);
        myConn.on('open', () => {
            document.getElementById('net-status-label').innerText = "Conectado com sucesso!";
            document.getElementById('net-status-label').style.color = "#00ff88";
        });
        myConn.on('data', (d) => handleData('host', d));
    });
}

function updateLobbyStatus() {
    if (gameMode === 'bot') return;
    const label = document.getElementById('net-status-label');
    const currentTotal = hostConns.length + 1;
    const maxTotal = maxClients + 1;
    label.innerText = `Jogadores Conectados: (${currentTotal}/${maxTotal})`;
    label.style.color = hostConns.length >= maxClients ? "#00ff88" : "#f0ad4e";
    
    if (hostConns.length >= maxClients) {
        btnStart.disabled = false;
        btnStart.innerText = "INICIAR PARTIDA";
    } else {
        btnStart.disabled = true;
        btnStart.innerText = `AGUARDANDO (${currentTotal}/${maxTotal})`;
    }
}

function broadcastData(data, excludePeer = null) {
    if (isHost) { hostConns.forEach(c => { if (c.peer !== excludePeer) c.send(data); }); } 
    else if (myConn) { myConn.send(data); }
}

function handleData(senderId, data) {
    if (isHost && data.type !== 'hit' && data.type !== 'start_game') { 
        data.id = senderId; 
        broadcastData(data, senderId); 
    }
    const peerId = data.id || senderId;

    if (data.type === 'start_game') {
        selectedMap = data.map;
        startGameSession();
    }
    if (data.type === 'pos_update') {
        if (!networkPlayers[peerId]) createNetworkPlayer(peerId, data.nick || "Inimigo");
        networkPlayers[peerId].position.set(data.x, data.y, data.z);
        networkPlayers[peerId].rotation.y = data.ry;
    }
    if (data.type === 'shoot') {
        playShootSound();
        createBulletTracer(new THREE.Vector3(data.sx, data.sy, data.sz), new THREE.Vector3(data.ex, data.ey, data.ez));
    }
    if (data.type === 'hit' && data.target === (isHost ? 'host' : peer.id)) {
        takeDamage(data.dmg, new THREE.Vector3(data.srcX, data.srcY, data.srcZ));
    }
    if (data.type === 'score_update') {
        playerScores = data.scores;
        updateScoreboard();
    }
    if (data.type === 'death') {
        showKillFeed(`${data.killerNick || "Alguém"} eliminou um jogador!`);
        if (isHost) {
            if (!playerScores[data.killerId]) playerScores[data.killerId] = 0;
            playerScores[data.killerId]++;
            broadcastData({ type: 'score_update', scores: playerScores });
            updateScoreboard();
        }
    }
}

function createNetworkPlayer(id, nick) {
    if (networkPlayers[id]) return;
    const group = new THREE.Group();
    
    const matUniform = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.7 });
    const matVest = new THREE.MeshStandardMaterial({ color: 0x1a252f, roughness: 0.5 });
    const matSkin = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.8 });
    const matHelmet = new THREE.MeshStandardMaterial({ color: 0x34495e, metalness: 0.3, roughness: 0.4 });
    const matGun = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 });

    const legGeo = new THREE.BoxGeometry(0.22, 0.9, 0.25);
    const legLeft = new THREE.Mesh(legGeo, matUniform); legLeft.position.set(-0.13, 0.45, 0);
    const legRight = new THREE.Mesh(legGeo, matUniform); legRight.position.set(0.13, 0.45, 0);

    const torsoGeo = new THREE.BoxGeometry(0.5, 0.75, 0.3);
    const torso = new THREE.Mesh(torsoGeo, matUniform); torso.position.set(0, 1.25, 0);

    const vestGeo = new THREE.BoxGeometry(0.52, 0.5, 0.32);
    const vest = new THREE.Mesh(vestGeo, matVest); vest.position.set(0, 1.3, 0);

    const headGeo = new THREE.BoxGeometry(0.28, 0.32, 0.28);
    const head = new THREE.Mesh(headGeo, matSkin); head.position.set(0, 1.82, 0);

    const helmetGeo = new THREE.BoxGeometry(0.32, 0.18, 0.32);
    const helmet = new THREE.Mesh(helmetGeo, matHelmet); helmet.position.set(0, 1.93, 0);

    const armGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18);
    const armLeft = new THREE.Mesh(armGeo, matUniform); armLeft.position.set(-0.36, 1.25, 0);
    const armRight = new THREE.Mesh(armGeo, matUniform); armRight.position.set(0.36, 1.25, 0);

    const rifleGeo = new THREE.BoxGeometry(0.1, 0.12, 0.7);
    const rifle = new THREE.Mesh(rifleGeo, matGun); rifle.position.set(0.2, 1.05, -0.25); rifle.rotation.x = 0.2;

    group.add(legLeft, legRight, torso, vest, head, helmet, armLeft, armRight, rifle);
    
    const hitboxBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 1.9, 12),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    hitboxBody.position.y = 0.95;
    group.add(hitboxBody);

    scene.add(group);
    wallMeshes.push(hitboxBody);
    networkPlayers[id] = group;
    if (!playerScores[id]) playerScores[id] = 0;
}

let scene, camera, renderer, prevTime = performance.now();
let moveF = false, moveB = false, moveL = false, moveR = false, canJump = true;
let isRunning = false, isCrouching = false;
let velocity = new THREE.Vector3(), currentHeight = 1.8;
let hp = 100, isDead = false;
let gunGroup, muzzleFlashMesh, muzzleLight;
let bots = []; 
let collidables = [], wallMeshes = [], mapWallMeshes = [];
const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
let recoilOffset = 0;
let playerBox = new THREE.Box3(), botBox = new THREE.Box3();
let lastSentTime = 0;

btnStart.addEventListener('click', () => {
    playerNick = document.getElementById('player-nick').value || "Striker";
    selectedMap = document.getElementById('map-select').value;
    
    const myId = isHost ? 'host' : peer.id;
    playerScores[myId] = 0;

    if (isHost && gameMode !== 'bot') {
        broadcastData({ type: 'start_game', map: selectedMap });
    }
    startGameSession();
});

function startGameSession() {
    document.getElementById('lobby-container').style.display = 'none';
    container.style.display = 'block';
    document.getElementById('scoreboard').style.display = 'flex';
    document.getElementById('hud-bottom-left').style.display = 'flex';
    document.getElementById('hud-bottom-right').style.display = 'flex';
    document.getElementById('buy-hint').style.display = 'block';
    document.getElementById('crosshair').style.display = 'block';
    
    updateHUD();
    initGameEngine();
    updateScoreboard();
    animate();
    document.body.requestPointerLock();
}

document.getElementById('btn-resume').addEventListener('click', () => document.body.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
    pointerLocked = !!document.pointerLockElement;
    if (pointerLocked) { 
        pauseScreen.style.display = 'none'; 
        if(buyMenuOpen) toggleBuyMenu(false); 
    } else { 
        moveF = moveB = moveL = moveR = false; 
        isMouseDown = false;
        if(!buyMenuOpen && !isDead) pauseScreen.style.display = 'flex'; 
    }
});

function toggleBuyMenu(show) {
    buyMenuOpen = show;
    if(show) {
        document.exitPointerLock();
        isMouseDown = false;
        document.getElementById('buy-money-display').innerText = `$${playerMoney}`;
        buyMenu.classList.remove('hidden');
    } else {
        buyMenu.classList.add('hidden');
        if(!isDead) document.body.requestPointerLock();
    }
}

function buyWeapon(key) {
    const item = itemsConfig[key];
    if (!item || playerMoney < item.price) return;

    if (item.type === 'gear') {
        if (key === 'armor') {
            if (hasArmor) return;
            hasArmor = true; playerMoney -= item.price;
        } else if (key === 'helmet') {
            if (hasHelmet) return;
            hasHelmet = true; playerMoney -= item.price;
        } else if (key === 'grenade') {
            grenadesCount++; playerMoney -= item.price;
        }
    } else {
        playerMoney -= item.price;
        if (item.slot === 'secondary') {
            inventory.secondary = { key: key, ammo: item.maxAmmo, reserveAmmo: item.totalAmmo };
            activeSlot = 'secondary';
        } else {
            inventory.primary = { key: key, ammo: item.maxAmmo, reserveAmmo: item.totalAmmo };
            activeSlot = 'primary';
        }
        build3DWeapon();
    }
    updateHUD();
    toggleBuyMenu(false);
}

function updateHUD() {
    const curWeaponData = itemsConfig[getCurrentWeaponKey()];
    document.getElementById('hp').innerText = Math.max(0, Math.round(hp));
    document.getElementById('money-display').innerText = `$${playerMoney}`;
    document.getElementById('ammo').innerText = curWeaponData.maxAmmo ? inventory[activeSlot].ammo : '-';
    document.getElementById('reserve-ammo').innerText = curWeaponData.maxAmmo ? `/ ${inventory[activeSlot].reserveAmmo}` : '';
    document.getElementById('weapon-display').innerText = curWeaponData.name + (hasArmor ? " [Colete]" : "") + (hasHelmet ? " [Capacete]" : "") + (grenadesCount > 0 ? ` [Granada: ${grenadesCount}]` : "");
}

function updateScoreboard() {
    const wrapper = document.getElementById('score-wrapper');
    wrapper.innerHTML = '';
    
    if (gameMode === 'bot') {
        const myId = isHost ? 'host' : peer.id;
        const myScore = playerScores[myId] || 0;
        const enemyScore = playerScores['bots'] || 0;
        wrapper.innerHTML = `<div class="score-card"><span class="p-name">${playerNick.toUpperCase()}:</span><span class="p-score">${myScore}</span></div>`;
        wrapper.innerHTML += ` &nbsp;|&nbsp; <div class="score-card"><span class="p-name">BOTS:</span><span class="p-score">${enemyScore}</span></div>`;
    } else {
        const myId = isHost ? 'host' : peer.id;
        wrapper.innerHTML += `<div class="score-card"><span class="p-name">${playerNick.toUpperCase()}:</span><span class="p-score">${playerScores[myId] || 0}</span></div>`;
        
        let pCount = 2;
        for (let id in networkPlayers) {
            wrapper.innerHTML += ` &nbsp;|&nbsp; <div class="score-card"><span class="p-name">PLAYER ${pCount++}:</span><span class="p-score">${playerScores[id] || 0}</span></div>`;
        }
    }
}

function getCurrentWeaponKey() {
    return inventory[activeSlot] ? inventory[activeSlot].key : 'deagle';
}

function initGameEngine() {
    scene = new THREE.Scene();
    
    let bgColor = 0xd6e4f0;
    if(selectedMap === 'mirage') bgColor = 0xaecce8;
    if(selectedMap === 'inferno') bgColor = 0x5a6978;
    if(selectedMap === 'nuke') bgColor = 0x4a5568;
    
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.FogExp2(bgColor, 0.002);

    camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.copy(getSafeSpawn(null)); 

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85); scene.add(ambientLight);
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x666677, 1.1); hemiLight.position.set(0, 100, 0); scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xfffaee, 1.4);
    dirLight.position.set(120, 250, 120); dirLight.castShadow = true;
    scene.add(dirLight);

    buildMapGeometries();

    if (!document.getElementById('sniper-scope')) {
        const scopeDiv = document.createElement('div');
        scopeDiv.id = 'sniper-scope';
        scopeDiv.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;display:none;z-index:10;background:radial-gradient(circle, transparent 25%, rgba(0,0,0,0.85) 60%, black 90%);box-shadow: inset 0 0 100px rgba(0,0,0,0.9);';
        scopeDiv.innerHTML = '<div style="position:absolute;top:50%;left:0;width:100%;height:2px;background:rgba(0,0,0,0.7);"></div><div style="position:absolute;top:0;left:50%;width:2px;height:100%;background:rgba(0,0,0,0.7);"></div>';
        document.body.appendChild(scopeDiv);
    }

    if (gameMode === 'bot') {
        bots = [];
        for (let i = 0; i < 5; i++) {
            const botId = 'bot_' + i;
            createNetworkPlayer(botId, "Bot " + i);
            let bMesh = networkPlayers[botId];
            let bPos = getSafeSpawn(camera.position);
            bMesh.position.copy(bPos);
            bots.push({
                id: botId,
                mesh: bMesh,
                hp: 100,
                lastShot: 0,
                strafeDir: (i % 2 === 0 ? 1 : -1),
                pos: bPos
            });
        }
    }

    gunGroup = new THREE.Group();
    camera.add(gunGroup); scene.add(camera);
    build3DWeapon();

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    document.addEventListener('mousemove', (e) => {
        if (!pointerLocked || isDead || buyMenuOpen) return;
        const sens = isAiming ? 0.0006 : 0.0015;
        cameraEuler.y -= e.movementX * sens;
        cameraEuler.x -= e.movementY * sens;
        cameraEuler.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, cameraEuler.x));
        camera.quaternion.setFromEuler(cameraEuler);
    });

    window.addEventListener('wheel', (e) => {
        if (!pointerLocked || isDead || buyMenuOpen) return;
        if (inventory.primary) {
            activeSlot = (activeSlot === 'secondary') ? 'primary' : 'secondary';
            build3DWeapon();
            setAim(false);
            updateHUD();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (isDead) return;
        if (e.code === 'KeyB') toggleBuyMenu(!buyMenuOpen);
        if (e.code === 'KeyG') throwGrenade();
        if (!pointerLocked || buyMenuOpen) return;

        // Duplo Clique no W para Correr
        if (e.code === 'KeyW' && !moveF) {
            const now = performance.now();
            if (now - lastWPressTime < 280) {
                isRunning = true;
            }
            lastWPressTime = now;
            moveF = true;
        }

        switch(e.code) {
            case 'KeyS': moveB = true; break;
            case 'KeyA': moveL = true; break;
            case 'KeyD': moveR = true; break;
            case 'Digit1':
                if (inventory.primary) { activeSlot = 'primary'; build3DWeapon(); setAim(false); updateHUD(); }
                break;
            case 'Digit2':
                activeSlot = 'secondary'; build3DWeapon(); setAim(false); updateHUD();
                break;
            case 'ControlLeft': isCrouching = true; currentHeight = 1.0; break;
            case 'Space': if(canJump) { velocity.y = 8.5; canJump = false; } break;
            case 'KeyR': reload(); break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch(e.code) {
            case 'KeyW': moveF = false; isRunning = false; break;
            case 'KeyS': moveB = false; break;
            case 'KeyA': moveL = false; break;
            case 'KeyD': moveR = false; break;
            case 'ControlLeft': isCrouching = false; currentHeight = 1.8; break;
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (buyMenuOpen || isDead) return;
        if (!pointerLocked) { document.body.requestPointerLock(); return; }
        if (e.button === 0) {
            isMouseDown = true;
            shoot();
        }
        if (e.button === 2) setAim(true);
    });
    
    document.addEventListener('mouseup', (e) => { 
        if (e.button === 0) isMouseDown = false;
        if (e.button === 2) setAim(false); 
    });
}

function getSafeSpawn(avoidPos) {
    let bestPoint = safeSpawns[0];
    let attempts = 0;
    while(attempts < 10) {
        let pt = safeSpawns[Math.floor(Math.random() * safeSpawns.length)];
        let testVec = new THREE.Vector3(pt.x, 1.8, pt.z);
        if(!avoidPos || avoidPos.distanceTo(testVec) > 25) { bestPoint = pt; break; }
        attempts++;
    }
    return new THREE.Vector3(bestPoint.x, 1.8, bestPoint.z);
}

// TEXTURA DE PAREDE LIMPA
function createWallTexture(baseColor) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = baseColor; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 2);
    return tex;
}

function buildMapGeometries() {
    collidables = []; wallMeshes = []; mapWallMeshes = [];
    
    let fColor, wColor, bColor;
    
    if(selectedMap === 'dust2') {
        fColor = 0xc9a87d; wColor = '#d6c29a'; bColor = '#8c6747';
    } else if(selectedMap === 'mirage') {
        fColor = 0xb09b7b; wColor = '#e0d0b0'; bColor = '#5a7694';
    } else if(selectedMap === 'inferno') {
        fColor = 0x555555; wColor = '#a84b38'; bColor = '#7c9683';
    } else { // Nuke
        fColor = 0x2b3036; wColor = '#708090'; bColor = '#427aa1';
    }

    const fMat = new THREE.MeshStandardMaterial({ color: fColor, roughness: 0.9 });
    const wMat = new THREE.MeshStandardMaterial({ map: createWallTexture(wColor), roughness: 0.8 });
    const bMat = new THREE.MeshStandardMaterial({ map: createWallTexture(bColor), roughness: 0.8 });

    // Chão Principal
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), fMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    // Muros Delimitadores da Cidade
    createBlock(0, 10, -150, 300, 20, 2, wMat); 
    createBlock(0, 10, 150, 300, 20, 2, wMat);
    createBlock(-150, 10, 0, 2, 20, 300, wMat); 
    createBlock(150, 10, 0, 2, 20, 300, wMat);

    // PRÉDIOS ESTRUTURADOS COM JANELAS VAZADAS E RAMPAS INTERNAS
    const cityLayout = [
        {x: -70, z: 70, w: 30, d: 30, h: 24, mat: wMat},
        {x: 70, z: 70, w: 30, d: 30, h: 24, mat: bMat},
        {x: -70, z: -70, w: 30, d: 30, h: 24, mat: bMat},
        {x: 70, z: -70, w: 30, d: 30, h: 24, mat: wMat}
    ];

    cityLayout.forEach(b => {
        createFunctionalBuilding(b.x, b.z, b.w, b.d, b.h, b.mat);
    });

    // ADICIONANDO PROPAGAÇÃO DE OBJETOS ESPECÍFICOS POR MAPA
    if (selectedMap === 'dust2') {
        // Caixas de Madeira do Deserto
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
        createBlock(15, 2, 15, 4, 4, 4, boxMat);
        createBlock(-20, 2, 30, 5, 4, 5, boxMat);
        createBlock(0, 2, -40, 6, 4, 4, boxMat);
        createCactus(-35, 15); createCactus(40, -25);
    } 
    else if (selectedMap === 'mirage') {
        // Árvores e Bancos Urbanos
        createTree(-20, 20); createTree(25, -20); createTree(-30, -30);
        const benchMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18 });
        createBlock(10, 1, 30, 6, 1.5, 2, benchMat);
        createBlock(-10, 1, -30, 6, 1.5, 2, benchMat);
    } 
    else if (selectedMap === 'inferno') {
        // Vilarejo com Árvores densas e paredes rústicas
        createTree(-15, 40); createTree(20, -40); createTree(40, 20); createTree(-40, -15);
    } 
    else if (selectedMap === 'nuke') {
        // Barris Industriais e Caixas Metálicas
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x445566, metalness: 0.8, roughness: 0.3 });
        createBlock(20, 2, 0, 4, 4, 8, metalMat);
        createBlock(-20, 2, 0, 4, 4, 8, metalMat);
        createBarrel(10, -15); createBarrel(-15, 25);
    }
}

// PRÉDIO COM INTERIOR ACESSÍVEL, RAMPAS E JANELAS VAZADAS
function createFunctionalBuilding(x, z, width, depth, height, mat) {
    const wallT = 1.5;
    const floorH = height / 2;
    const winW = 6, winH = 4, winY = 4;

    // Paredes Frontal e Traseira com Janelas Vazadas
    // Parede Frontal (Dividida para criar janela)
    createBlock(x - width/4 - 1, winY/2, z + depth/2, width/2 - 2, winY, wallT, mat);
    createBlock(x + width/4 + 1, winY/2, z + depth/2, width/2 - 2, winY, wallT, mat);
    createBlock(x, winY + winH + (floorH - winY - winH)/2, z + depth/2, width, floorH - winY - winH, wallT, mat);

    // Parede Traseira Completa
    createBlock(x, height/2, z - depth/2, width, height, wallT, mat);

    // Lado Esquerdo e Lado Direito
    createBlock(x - width/2, height/2, z, wallT, height, depth, mat);
    createBlock(x + width/2, height/2, z, wallT, height, depth, mat);

    // Laje do 2º Andar com abertura para a Rampa
    createBlock(x - 3, floorH, z, width - 8, 0.5, depth - 2, mat);

    // Rampa de Acesso ao 2º Andar
    const rampGeo = new THREE.BoxGeometry(6, 0.4, floorH * 1.5);
    const ramp = new THREE.Mesh(rampGeo, mat);
    ramp.position.set(x + width/2 - 5, floorH/2, z);
    ramp.rotation.x = 0.45;
    ramp.receiveShadow = true; ramp.castShadow = true;
    scene.add(ramp);
    collidables.push(new THREE.Box3().setFromObject(ramp));
    wallMeshes.push(ramp); mapWallMeshes.push(ramp);
}

// ELEMENTOS DE CENÁRIO (ÁRVORES, CACTOS E BARRIS)
function createTree(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 6), new THREE.MeshStandardMaterial({color: 0x4a2e18}));
    trunk.position.set(x, 3, z); trunk.castShadow = true; scene.add(trunk);
    collidables.push(new THREE.Box3().setFromObject(trunk));
    
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(3.5, 8, 8), new THREE.MeshStandardMaterial({color: 0x2d5a27, roughness: 0.9}));
    leaves.position.set(x, 7.5, z); leaves.castShadow = true; scene.add(leaves);
}

function createCactus(x, z) {
    const cacMat = new THREE.MeshStandardMaterial({color: 0x3b6e36, roughness: 0.8});
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 7), cacMat);
    body.position.set(x, 3.5, z); body.castShadow = true; scene.add(body);
    collidables.push(new THREE.Box3().setFromObject(body));
}

function createBarrel(x, z) {
    const bMat = new THREE.MeshStandardMaterial({color: 0xc0392b, metalness: 0.5, roughness: 0.4});
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.5, 12), bMat);
    barrel.position.set(x, 1.75, z); barrel.castShadow = true; scene.add(barrel);
    collidables.push(new THREE.Box3().setFromObject(barrel));
}

function createBlock(x, y, z, w, h, d, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    collidables.push(new THREE.Box3().setFromObject(mesh)); 
    wallMeshes.push(mesh); 
    mapWallMeshes.push(mesh);
}

function throwGrenade() {
    if (grenadesCount <= 0 || isDead || buyMenuOpen) return;
    grenadesCount--;
    updateHUD();

    const gGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const gMat = new THREE.MeshStandardMaterial({color: 0x222222, metalness: 0.8, roughness: 0.4});
    const gMesh = new THREE.Mesh(gGeo, gMat);
    gMesh.position.copy(camera.position);

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const velocity = camDir.clone().multiplyScalar(22).add(new THREE.Vector3(0, 6, 0));

    scene.add(gMesh);
    activeGrenades.push({
        mesh: gMesh,
        velocity: velocity,
        explosionTime: performance.now() + 2000
    });
}

function updateGrenades(delta, time) {
    for (let i = activeGrenades.length - 1; i >= 0; i--) {
        let g = activeGrenades[i];
        g.velocity.y -= 9.8 * 2.5 * delta;
        g.mesh.position.addScaledVector(g.velocity, delta);

        if (g.mesh.position.y < 0.2) {
            g.mesh.position.y = 0.2;
            g.velocity.x *= 0.7;
            g.velocity.z *= 0.7;
        }

        if (time >= g.explosionTime) {
            playExplosionSound();
            
            const expLight = new THREE.PointLight(0xff5500, 5, 25);
            expLight.position.copy(g.mesh.position);
            scene.add(expLight);
            setTimeout(() => scene.remove(expLight), 200);

            if (gameMode === 'bot') {
                for (let bot of bots) {
                    if (bot.mesh.position.distanceTo(g.mesh.position) < 12) {
                        bot.hp -= 90;
                        if (bot.hp <= 0) {
                            const myId = isHost ? 'host' : peer.id;
                            playerScores[myId] = (playerScores[myId] || 0) + 1;
                            playerMoney += 300; updateHUD(); updateScoreboard();
                            showKillFeed("+ $300 (Granada HE)");
                            bot.hp = 100;
                            bot.pos.copy(getSafeSpawn(camera.position)); 
                            bot.mesh.position.copy(bot.pos);
                        }
                    }
                }
            }

            scene.remove(g.mesh);
            activeGrenades.splice(i, 1);
        }
    }
}

function build3DWeapon() {
    while(gunGroup.children.length > 0) gunGroup.remove(gunGroup.children[0]);
    const mDark = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, metalness: 0.7, roughness: 0.4 });
    const mWood = new THREE.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.8 });
    let barrelOffsetZ = -0.45;
    const curKey = getCurrentWeaponKey();

    if(curKey === 'ak47') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.45), mDark);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.2), mWood); stock.position.set(0, -0.02, 0.3);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3), mDark); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.01, -0.45);
        gunGroup.add(body, stock, barrel);
    } else if(curKey === 'awp') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.6), new THREE.MeshStandardMaterial({color: 0x243621}));
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25), mDark); scope.rotation.x = Math.PI/2; scope.position.set(0, 0.07, -0.05);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5), mDark); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.02, -0.55);
        barrelOffsetZ = -0.8;
        gunGroup.add(body, scope, barrel);
    } else if(curKey === 'p90') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.08, 0.35), mDark);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.2), mDark); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.01, -0.35);
        barrelOffsetZ = -0.45;
        gunGroup.add(body, barrel);
    } else { 
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.35), mDark);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2), mDark); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0, -0.27);
        barrelOffsetZ = -0.37;
        gunGroup.add(body, barrel);
    }

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.6 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 });
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.2), sleeveMat);
    arm.rotation.x = Math.PI / 2; arm.position.set(-0.03, -0.05, 0.1);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.03), skinMat);
    hand.position.set(-0.02, -0.01, -0.05);
    gunGroup.add(arm, hand);

    muzzleFlashMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0, depthWrite: false }));
    muzzleFlashMesh.position.set(0, 0.01, barrelOffsetZ);
    muzzleLight = new THREE.PointLight(0xffaa00, 0, 8);
    muzzleLight.position.set(0, 0, barrelOffsetZ);
    gunGroup.add(muzzleFlashMesh, muzzleLight);
    
    gunGroup.position.set(0.18, -0.22, -0.3);
}

function setAim(active) {
    if(isDead || buyMenuOpen) return;
    isAiming = active;
    const isAwp = (getCurrentWeaponKey() === 'awp');
    document.getElementById('crosshair').style.opacity = (active && isAwp) ? '0' : '1';
    
    const scopeDiv = document.getElementById('sniper-scope');
    if (scopeDiv) {
        scopeDiv.style.display = (active && isAwp) ? 'block' : 'none';
    }
}

function createBulletTracer(startPos, endPos) {
    const geometry = new THREE.BufferGeometry().setFromPoints([startPos, endPos]);
    const material = new THREE.LineBasicMaterial({ color: 0xffea55, linewidth: 2, transparent: true, opacity: 0.8 });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    setTimeout(() => scene.remove(line), 60);
}

function shoot() {
    if(isDead || buyMenuOpen || inventory[activeSlot].ammo <= 0) return;
    const now = performance.now(), curKey = getCurrentWeaponKey(), cfg = itemsConfig[curKey];
    if (now - lastShotTime < cfg.fireRate) return;

    lastShotTime = now; inventory[activeSlot].ammo--; updateHUD();
    playShootSound();

    gunGroup.position.z += 0.05; setTimeout(() => gunGroup.position.z -= 0.05, 50);
    muzzleFlashMesh.material.opacity = 0.8; muzzleFlashMesh.rotation.z = Math.random() * Math.PI; muzzleLight.intensity = 2.0;
    setTimeout(() => { muzzleFlashMesh.material.opacity = 0; muzzleLight.intensity = 0; }, 40);

    recoilOffset += cfg.recoil;
    cameraEuler.x += cfg.recoil; 
    cameraEuler.y += (Math.random() - 0.5) * (cfg.recoil * 0.4); 
    camera.quaternion.setFromEuler(cameraEuler);

    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0,0), camera);
    let spr = cfg.spread * (isAiming ? 0.3 : (Math.abs(velocity.x)>1 ? 2.5 : 1.0));
    ray.ray.direction.x += (Math.random() - 0.5) * spr;
    ray.ray.direction.y += (Math.random() - 0.5) * spr;

    let endPoint = ray.ray.at(100, new THREE.Vector3());
    const hits = ray.intersectObjects(wallMeshes);
    let hitPlayer = false;

    if (hits.length > 0) {
        const hit = hits[0];
        endPoint.copy(hit.point);
        
        if (gameMode === 'bot') {
            for (let bot of bots) {
                if (hit.object.parent === bot.mesh || hit.object === bot.mesh) {
                    bot.hp -= cfg.damage; hitPlayer = true;
                    if (bot.hp <= 0) {
                        const myId = isHost ? 'host' : peer.id;
                        playerScores[myId] = (playerScores[myId] || 0) + 1;
                        playerMoney += 300; updateHUD(); updateScoreboard();
                        showKillFeed("+ $300 (Eliminação)");
                        bot.hp = 100;
                        bot.pos.copy(getSafeSpawn(camera.position)); 
                        bot.mesh.position.copy(bot.pos);
                    }
                    break;
                }
            }
        } 
        else if (gameMode !== 'bot') {
            for (let id in networkPlayers) {
                if (hit.object.parent === networkPlayers[id] || hit.object === networkPlayers[id]) {
                    broadcastData({ type: 'hit', target: id, dmg: cfg.damage, srcX: camera.position.x, srcY: camera.position.y, srcZ: camera.position.z });
                    hitPlayer = true; break;
                }
            }
        }

        if(!hitPlayer) {
            const spark = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), new THREE.MeshBasicMaterial({color: 0xffdd88}));
            spark.position.copy(hit.point); scene.add(spark);
            setTimeout(() => scene.remove(spark), 100);
        }
    }

    createBulletTracer(camera.position, endPoint);
    if (gameMode !== 'bot') {
        broadcastData({
            type: 'shoot',
            sx: camera.position.x, sy: camera.position.y, sz: camera.position.z,
            ex: endPoint.x, ey: endPoint.y, ez: endPoint.z
        });
    }
}

// SISTEMA DE DANO E PROTEÇÃO FUNCIONAL COM COLETE E CAPACETE
function takeDamage(dmg, sourcePos) {
    if (isDead || isInvulnerable) return;

    let finalDmg = dmg;
    const isHeadshot = sourcePos && (sourcePos.y > camera.position.y + 0.2);

    if (isHeadshot) {
        if (hasHelmet) {
            finalDmg *= 0.4; // Capacete reduz 60% do dano na cabeça
        }
    } else {
        if (hasArmor) {
            finalDmg *= 0.65; // Colete reduz 35% do dano corporal
        }
    }

    hp -= finalDmg;
    
    document.getElementById('damage-overlay').style.boxShadow = "inset 0 0 200px rgba(255, 0, 0, 0.6)";
    setTimeout(() => document.getElementById('damage-overlay').style.boxShadow = "inset 0 0 150px rgba(255,0,0,0)", 150);
    
    if(sourcePos) {
        lastKillerPos = sourcePos.clone();
        const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
        const toHit = new THREE.Vector3().subVectors(sourcePos, camera.position); toHit.y = 0; toHit.normalize();
        let angle = Math.atan2(camDir.clone().cross(toHit).y, camDir.dot(toHit));
        const deg = (angle * (180 / Math.PI)) * -1;
        
        const ind = document.getElementById('damage-indicator');
        ind.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
        ind.style.opacity = 1;
        setTimeout(() => ind.style.opacity = 0, 1500);
    }
    
    if (hp <= 0) {
        hp = 0; isDead = true;
        isMouseDown = false;
        if(gameMode !== 'bot') {
            const myId = isHost ? 'host' : peer.id;
            broadcastData({ type: 'death', killerNick: playerNick, killerId: myId });
        } else { 
            playerScores['bots'] = (playerScores['bots'] || 0) + 1;
            updateScoreboard(); 
        }
        const msg = document.getElementById('round-message');
        msg.innerText = "VOCÊ FOI ELIMINADO";
        msg.style.display = 'block';

        const scopeDiv = document.getElementById('sniper-scope');
        if(scopeDiv) scopeDiv.style.display = 'none';

        document.exitPointerLock();
        setTimeout(restartRound, 3000);
    }
    updateHUD();
}

function restartRound() {
    hp = 100; isDead = false; lastKillerPos = null;
    playerMoney = 5000; 
    inventory = { secondary: { key: 'deagle', ammo: 7, reserveAmmo: 35 }, primary: null };
    activeSlot = 'secondary';
    hasArmor = false; hasHelmet = false; grenadesCount = 0;
    
    isInvulnerable = true;
    if (invulnerableTimeout) clearTimeout(invulnerableTimeout);
    
    const msg = document.getElementById('round-message');
    msg.innerText = "REVIVEU! INVULNERÁVEL POR 3s";
    msg.style.display = 'block';
    
    invulnerableTimeout = setTimeout(() => {
        isInvulnerable = false;
        if (!isDead) msg.style.display = 'none';
    }, 3000);

    updateHUD();
    build3DWeapon();
    camera.position.copy(getSafeSpawn(null)); 
    
    if (gameMode === 'bot') {
        bots.forEach((bot) => {
            bot.hp = 100;
            bot.pos.copy(getSafeSpawn(camera.position));
            bot.mesh.position.copy(bot.pos);
        });
    }
    
    document.body.requestPointerLock();
}

function reload() {
    const curInv = inventory[activeSlot];
    const cfg = itemsConfig[curInv.key];
    if (curInv.ammo === cfg.maxAmmo || curInv.reserveAmmo <= 0) return;
    playReloadSound();
    document.getElementById('ammo').innerText = "--";
    setTimeout(() => {
        const need = cfg.maxAmmo - curInv.ammo;
        const add = Math.min(need, curInv.reserveAmmo);
        curInv.ammo += add; curInv.reserveAmmo -= add;
        updateHUD();
    }, 1500);
}

function showKillFeed(txt) {
    const feed = document.getElementById('kill-feed');
    feed.innerText = txt; feed.style.display = 'block';
    setTimeout(() => feed.style.display='none', 2000);
}

function updateBotLogic(delta, time) {
    if (gameMode !== 'bot' || isDead) return;

    for (let bot of bots) {
        if (!bot.mesh) continue;
        const dist = bot.mesh.position.distanceTo(camera.position);
        
        let hasLOS = false;
        const dirToPlayer = new THREE.Vector3().subVectors(camera.position, bot.mesh.position).normalize();
        const ray = new THREE.Raycaster(new THREE.Vector3().copy(bot.mesh.position).add(new THREE.Vector3(0,0.8,0)), dirToPlayer);
        const hits = ray.intersectObjects(mapWallMeshes);
        if (hits.length === 0 || hits[0].distance >= dist - 1.5) hasLOS = true;

        bot.mesh.lookAt(camera.position.x, bot.mesh.position.y, camera.position.z);

        if (hasLOS && dist < 45) {
            if (time - bot.lastShot > 850) { 
                bot.lastShot = time; 
                playShootSound(); 
                if (Math.random() > 0.45) takeDamage(16, bot.mesh.position); 
            }
            
            const strafeVetor = new THREE.Vector3().crossVectors(dirToPlayer, new THREE.Vector3(0,1,0)).normalize();
            const oldPos = bot.mesh.position.clone();
            bot.mesh.position.addScaledVector(strafeVetor, 3.5 * bot.strafeDir * delta);
            
            botBox.setFromCenterAndSize(bot.mesh.position, new THREE.Vector3(1.2, 1.8, 1.2));
            for (let box of collidables) {
                if (botBox.intersectsBox(box)) { bot.mesh.position.copy(oldPos); bot.strafeDir *= -1; break; }
            }
            if (Math.random() < 0.01) bot.strafeDir *= -1;
        } else {
            const oldPos = bot.mesh.position.clone();
            const moveVetor = new THREE.Vector3();
            bot.mesh.getWorldDirection(moveVetor); moveVetor.y = 0; moveVetor.normalize();

            bot.mesh.position.addScaledVector(moveVetor, 5.0 * delta); 
            
            botBox.setFromCenterAndSize(bot.mesh.position, new THREE.Vector3(1.2, 1.8, 1.2));
            let collides = false;
            for (let box of collidables) {
                if (botBox.intersectsBox(box)) { collides = true; break; }
            }
            
            if (collides) {
                bot.mesh.position.copy(oldPos);
                bot.mesh.translateX(1.0 * bot.strafeDir); 
                bot.strafeDir *= -1;
            }
        }
        bot.pos.copy(bot.mesh.position);
    }
}

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now(), delta = Math.min((time - prevTime) / 1000, 0.1);

    updateGrenades(delta, time);

    if (pointerLocked && !isDead && !buyMenuOpen) {
        if (isMouseDown && itemsConfig[getCurrentWeaponKey()].auto) {
            shoot();
        }

        const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
        const camRight = new THREE.Vector3().crossVectors(camDir, camera.up).normalize();

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 4.5 * delta;

        let speed = isCrouching ? 25 : (isRunning ? 110 : 65);
        if(isAiming) speed *= 0.5;

        if (moveF) velocity.addScaledVector(camDir, speed * delta);
        if (moveB) velocity.addScaledVector(camDir, -speed * delta);
        if (moveL) velocity.addScaledVector(camRight, -speed * delta);
        if (moveR) velocity.addScaledVector(camRight, speed * delta);

        const oldPos = camera.position.clone();
        camera.position.addScaledVector(velocity, delta);

        playerBox.setFromCenterAndSize(camera.position, new THREE.Vector3(0.6, 1.8, 0.6));
        for (let box of collidables) {
            if (playerBox.intersectsBox(box)) { camera.position.copy(oldPos); velocity.set(0, 0, 0); break; }
        }
        if (camera.position.y < currentHeight) { camera.position.y = currentHeight; velocity.y = 0; canJump = true; }

        if (recoilOffset > 0 && (time - lastShotTime > 100)) {
            const recAmt = Math.min(recoilOffset, 2.5 * delta);
            cameraEuler.x -= recAmt; recoilOffset -= recAmt;
            camera.quaternion.setFromEuler(cameraEuler);
        }

        const isMoving = (Math.abs(velocity.x) > 1 || Math.abs(velocity.z) > 1);
        if (isMoving && !isAiming) {
            gunGroup.position.y = -0.22 + Math.sin(time * 0.012) * 0.008;
            gunGroup.position.x = 0.18 + Math.cos(time * 0.006) * 0.008;
        } else {
            gunGroup.position.y = THREE.MathUtils.lerp(gunGroup.position.y, isAiming ? -0.15 : -0.22, 0.15);
            gunGroup.position.x = THREE.MathUtils.lerp(gunGroup.position.x, isAiming ? 0 : 0.18, 0.15);
        }
    } else if (isDead && lastKillerPos) {
        camera.lookAt(lastKillerPos);
    }

    camera.fov += ((isAiming ? itemsConfig[getCurrentWeaponKey()].zoomFov || 50 : 80) - camera.fov) * 15 * delta;
    camera.updateProjectionMatrix();

    updateBotLogic(delta, time);

    if (gameMode !== 'bot' && time - lastSentTime > 40) {
        const myId = isHost ? 'host' : peer.id;
        broadcastData({ type: 'pos_update', id: myId, nick: playerNick, x: camera.position.x, y: camera.position.y, z: camera.position.z, ry: cameraEuler.y });
        lastSentTime = time;
    }

    prevTime = time;
    renderer.render(scene, camera);
}
