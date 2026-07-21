let gameMode = 'bot';
let maxClients = 0; 
let peer, isHost = true;
let hostConns = []; 
let myConn = null;  
let networkPlayers = {}; 
let playerNick = "Striker", selectedMap = "dust2";
let playerMoney = 800;

const weaponsConfig = {
    deagle: { name: "Desert Eagle", damage: 60, fireRate: 350, maxAmmo: 7, totalAmmo: 35, spread: 0.008, recoil: 0.015, price: 700 },
    p90:    { name: "P90", damage: 22, fireRate: 70, maxAmmo: 50, totalAmmo: 100, spread: 0.012, recoil: 0.005, price: 2350 },
    ak47:   { name: "AK-47", damage: 36, fireRate: 100, maxAmmo: 30, totalAmmo: 90, spread: 0.008, recoil: 0.010, price: 2700 },
    m4a4:   { name: "M4A4", damage: 28, fireRate: 88, maxAmmo: 30, totalAmmo: 90, spread: 0.006, recoil: 0.007, price: 3100 },
    awp:    { name: "AWP", damage: 115, fireRate: 1300, maxAmmo: 5, totalAmmo: 30, spread: 0.001, recoil: 0.030, price: 4750, zoomFov: 20 }
};

let currentWeapon = 'deagle';
let lastShotTime = 0, isAiming = false, pointerLocked = false, buyMenuOpen = false;

const btnStart = document.getElementById('btn-start');
const container = document.getElementById('canvas-container');
const pauseScreen = document.getElementById('pause-screen');
const buyMenu = document.getElementById('buy-menu');

const safeSpawns = [
    {x: -80, z: 80}, {x: 80, z: -80}, {x: -80, z: -80}, {x: 80, z: 80},
    {x: 0, z: 90}, {x: 0, z: -90}, {x: 90, z: 0}, {x: -90, z: 0}
];

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('room')) {
    isHost = false; gameMode = 'client'; maxClients = 0;
    document.getElementById('mode-1v1').classList.add('active');
    document.getElementById('mode-bot').classList.remove('active');
    document.getElementById('net-link-section').style.display = 'block';
    document.getElementById('net-status-label').innerText = "Conectando ao Host...";
    initClient(urlParams.get('room'));
} else {
    initHost();
}

function setGameMode(mode) {
    gameMode = mode;
    isHost = true;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('mode-' + mode).classList.add('active');
    
    if (mode === 'bot') {
        maxClients = 0;
        document.getElementById('net-link-section').style.display = 'none';
        btnStart.disabled = false;
    } else {
        maxClients = mode === '1v1' ? 1 : 2;
        document.getElementById('net-link-section').style.display = 'block';
        updateLobbyStatus();
        btnStart.disabled = hostConns.length < maxClients;
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
    });
}

function initClient(targetRoom) {
    peer = new Peer({ host: '0.peerjs.com', port: 443, path: '/', secure: true });
    peer.on('open', () => {
        myConn = peer.connect(targetRoom);
        myConn.on('open', () => {
            document.getElementById('net-status-label').innerText = "Pronto!";
            document.getElementById('net-status-label').style.color = "#00ff88";
            btnStart.disabled = false;
        });
        myConn.on('data', (d) => handleData('host', d));
    });
}

function updateLobbyStatus() {
    if (gameMode === 'bot') return;
    document.getElementById('net-status-label').innerText = `Jogadores Conectados: (${hostConns.length}/${maxClients})`;
    document.getElementById('net-status-label').style.color = hostConns.length >= maxClients ? "#00ff88" : "#f0ad4e";
    if (hostConns.length >= maxClients) btnStart.disabled = false;
}

function broadcastData(data, excludePeer = null) {
    if (isHost) { hostConns.forEach(c => { if (c.peer !== excludePeer) c.send(data); }); } 
    else if (myConn) { myConn.send(data); }
}

function handleData(senderId, data) {
    if (isHost && data.type !== 'hit') { data.id = senderId; broadcastData(data, senderId); }
    const peerId = data.id || senderId;

    if (data.type === 'pos_update') {
        if (!networkPlayers[peerId]) createNetworkPlayer(peerId);
        networkPlayers[peerId].position.set(data.x, data.y, data.z);
        networkPlayers[peerId].rotation.y = data.ry;
    }
    if (data.type === 'hit' && data.target === (isHost ? 'host' : peer.id)) {
        takeDamage(data.dmg, new THREE.Vector3(data.srcX, data.srcY, data.srcZ));
    }
    if (data.type === 'death') {
        showKillFeed("Jogador Eliminado!");
        if(isHost) enemyScore++; else myScore++;
        updateScoreboard();
    }
}

function createNetworkPlayer(id) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 16), new THREE.MeshStandardMaterial({ color: 0xb33939, roughness: 0.6 }));
    body.position.y = 0.9; body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshStandardMaterial({ color: 0xeccbcb }));
    head.position.y = 1.9; head.castShadow = true;
    group.add(body, head);
    scene.add(group);
    wallMeshes.push(body, head);
    networkPlayers[id] = group;
}

// VARIÁVEIS DA ENGINE
let scene, camera, renderer, prevTime = performance.now();
let moveF = false, moveB = false, moveL = false, moveR = false, canJump = true;
let isRunning = false, isCrouching = false;
let velocity = new THREE.Vector3(), currentHeight = 1.8;
let hp = 100, ammo = 7, reserveAmmo = 35, myScore = 0, enemyScore = 0, isDead = false;
let gunGroup, muzzleFlashMesh, muzzleLight, botMesh = null;
let collidables = [], wallMeshes = [];
const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
let recoilOffset = 0;
let botData = { pos: new THREE.Vector3(20, 1.2, -20), hp: 100, lastShot: 0, strafeDir: 1 };
let playerBox = new THREE.Box3(), botBox = new THREE.Box3();
let lastSentTime = 0;

// INICIAR
btnStart.addEventListener('click', () => {
    playerNick = document.getElementById('player-nick').value || "Striker";
    selectedMap = document.getElementById('map-select').value;
    document.getElementById('display-my-name').innerText = playerNick.toUpperCase();
    
    document.getElementById('lobby-container').style.display = 'none';
    container.style.display = 'block';
    document.getElementById('scoreboard').style.display = 'flex';
    document.getElementById('hud-bottom-left').style.display = 'flex';
    document.getElementById('hud-bottom-right').style.display = 'flex';
    document.getElementById('buy-hint').style.display = 'block';
    document.getElementById('crosshair').style.display = 'block';
    
    updateHUD();
    initGameEngine();
    animate();
    document.body.requestPointerLock();
});

document.getElementById('btn-resume').addEventListener('click', () => document.body.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
    pointerLocked = !!document.pointerLockElement;
    if (pointerLocked) { pauseScreen.style.display = 'none'; if(buyMenuOpen) toggleBuyMenu(false); } 
    else { moveF = moveB = moveL = moveR = false; if(!buyMenuOpen && !isDead) pauseScreen.style.display = 'flex'; }
});

function toggleBuyMenu(show) {
    buyMenuOpen = show;
    if(show) {
        document.exitPointerLock();
        document.getElementById('buy-money-display').innerText = `$${playerMoney}`;
        buyMenu.classList.remove('hidden');
    } else {
        buyMenu.classList.add('hidden');
        if(!isDead) document.body.requestPointerLock();
    }
}

function buyWeapon(key) {
    const w = weaponsConfig[key];
    if(playerMoney >= w.price) {
        playerMoney -= w.price; currentWeapon = key;
        ammo = w.maxAmmo; reserveAmmo = w.totalAmmo;
        updateHUD(); build3DWeapon(); toggleBuyMenu(false);
    }
}

function updateHUD() {
    document.getElementById('hp').innerText = hp;
    document.getElementById('money-display').innerText = `$${playerMoney}`;
    document.getElementById('ammo').innerText = ammo;
    document.getElementById('reserve-ammo').innerText = `/ ${reserveAmmo}`;
    document.getElementById('weapon-display').innerText = weaponsConfig[currentWeapon].name;
}
function updateScoreboard() {
    document.getElementById('score-player').innerText = myScore;
    document.getElementById('score-enemy').innerText = enemyScore;
}

// INICIALIZADOR DA ENGINE
function initGameEngine() {
    scene = new THREE.Scene();
    
    let bgColor = 0xdeceaa;
    if(selectedMap === 'mirage') bgColor = 0xaecce8;
    if(selectedMap === 'inferno') bgColor = 0x7c8c9e;
    if(selectedMap === 'nuke') bgColor = 0x8a99a8;
    
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.FogExp2(bgColor, 0.005);

    camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.copy(getSafeSpawn(null)); 

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); scene.add(ambientLight);
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444455, 0.7); hemiLight.position.set(0, 100, 0); scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xfffaee, 1.3);
    dirLight.position.set(60, 150, 40); dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    buildMapGeometries();

    if (gameMode === 'bot') {
        createNetworkPlayer('bot_id');
        botMesh = networkPlayers['bot_id'];
        botData.pos.copy(getSafeSpawn(camera.position));
        botMesh.position.copy(botData.pos);
    }

    gunGroup = new THREE.Group();
    camera.add(gunGroup); scene.add(camera);
    build3DWeapon();

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1; 
    container.appendChild(renderer.domElement);

    // CONTROLES
    document.addEventListener('mousemove', (e) => {
        if (!pointerLocked || isDead || buyMenuOpen) return;
        const sens = isAiming ? 0.0006 : 0.0015;
        cameraEuler.y -= e.movementX * sens;
        cameraEuler.x -= e.movementY * sens;
        cameraEuler.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, cameraEuler.x));
        camera.quaternion.setFromEuler(cameraEuler);
    });

    document.addEventListener('keydown', (e) => {
        if (isDead) return;
        if (e.code === 'KeyB') toggleBuyMenu(!buyMenuOpen);
        if (!pointerLocked || buyMenuOpen) return;
        switch(e.code) {
            case 'KeyW': moveF = true; break;
            case 'KeyS': moveB = true; break;
            case 'KeyA': moveL = true; break;
            case 'KeyD': moveR = true; break;
            case 'ShiftLeft': isRunning = true; break;
            case 'ControlLeft': isCrouching = true; currentHeight = 1.0; break;
            case 'Space': if(canJump) { velocity.y = 8.5; canJump = false; } break;
            case 'KeyR': reload(); break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch(e.code) {
            case 'KeyW': moveF = false; break;
            case 'KeyS': moveB = false; break;
            case 'KeyA': moveL = false; break;
            case 'KeyD': moveR = false; break;
            case 'ShiftLeft': isRunning = false; break;
            case 'ControlLeft': isCrouching = false; currentHeight = 1.8; break;
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (buyMenuOpen || isDead) return;
        if (!pointerLocked) { document.body.requestPointerLock(); return; }
        if (e.button === 0) shoot();
        if (e.button === 2) setAim(true);
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 2) setAim(false); });
}

function getSafeSpawn(avoidPos) {
    let bestPoint = safeSpawns[0];
    let attempts = 0;
    while(attempts < 10) {
        let pt = safeSpawns[Math.floor(Math.random() * safeSpawns.length)];
        if(!avoidPos || avoidPos.distanceTo(new THREE.Vector3(pt.x, 1.8, pt.z)) > 40) { bestPoint = pt; break; }
        attempts++;
    }
    return new THREE.Vector3(bestPoint.x, 1.8, bestPoint.z);
}

function createTexture(baseColor, detailColor, pattern) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = baseColor; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = detailColor;
    for(let i=0; i<4000; i++) {
        ctx.globalAlpha = Math.random() * 0.4;
        ctx.fillRect(Math.random()*512, Math.random()*512, Math.random()*4+1, Math.random()*4+1);
    }
    if(pattern === 'grid' || pattern === 'tiles') {
        ctx.globalAlpha = 0.5; ctx.strokeStyle = detailColor; ctx.lineWidth = 3;
        const size = pattern === 'tiles' ? 128 : 64;
        for(let i=0; i<512; i+=size) { ctx.strokeRect(0, i, 512, size); ctx.strokeRect(i, 0, size, 512); }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(12, 12);
    return tex;
}

function buildMapGeometries() {
    let fMat, wMat, bMat;
    
    if(selectedMap === 'dust2') {
        fMat = new THREE.MeshStandardMaterial({ map: createTexture('#c9a87d', '#8c704c', 'sand'), roughness: 1.0 });
        wMat = new THREE.MeshStandardMaterial({ map: createTexture('#bdab84', '#8c7d5c', 'grid'), roughness: 0.9 });
        bMat = new THREE.MeshStandardMaterial({ map: createTexture('#735336', '#47311d', 'grid'), roughness: 0.8 });
    } else if(selectedMap === 'mirage') {
        fMat = new THREE.MeshStandardMaterial({ map: createTexture('#8d918c', '#5e615e', 'sand'), roughness: 0.9 });
        wMat = new THREE.MeshStandardMaterial({ map: createTexture('#b09476', '#876c52', 'grid'), roughness: 0.9 });
        bMat = new THREE.MeshStandardMaterial({ color: 0x4a6582, roughness: 0.6 });
    } else if(selectedMap === 'inferno') {
        fMat = new THREE.MeshStandardMaterial({ map: createTexture('#545454', '#383838', 'tiles'), roughness: 0.8 });
        wMat = new THREE.MeshStandardMaterial({ map: createTexture('#9e4635', '#612a1f', 'grid'), roughness: 0.9 });
        bMat = new THREE.MeshStandardMaterial({ color: 0x6e8774, roughness: 0.7 });
    } else { 
        fMat = new THREE.MeshStandardMaterial({ map: createTexture('#4a5159', '#2a2f36', 'tiles'), roughness: 0.6, metalness: 0.2 });
        wMat = new THREE.MeshStandardMaterial({ map: createTexture('#c0c9d4', '#8c959e', 'grid'), roughness: 0.7 });
        bMat = new THREE.MeshStandardMaterial({ color: 0x3d7cc4, metalness: 0.4, roughness: 0.5 });
    }

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), fMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    createBlock(0, 5, -120, 240, 10, 2, wMat); createBlock(0, 5, 120, 240, 10, 2, wMat);
    createBlock(-120, 5, 0, 2, 10, 240, wMat); createBlock(120, 5, 0, 2, 10, 240, wMat);

    if(selectedMap === 'dust2') {
        createBlock(0, 4, 0, 24, 8, 24, wMat); 
        createBlock(-40, 3, 40, 10, 6, 10, bMat); createBlock(40, 3, -40, 10, 6, 10, bMat); 
        createBlock(-20, 2, -60, 6, 4, 16, bMat); createBlock(20, 2, 60, 6, 4, 16, bMat);
    } 
    else if (selectedMap === 'mirage') {
        createBlock(-30, 4, 0, 10, 10, 40, wMat); createBlock(30, 4, 0, 10, 10, 40, wMat); 
        createBlock(0, 2, 0, 15, 4, 15, bMat); 
        createBlock(-60, 3, 50, 12, 6, 12, bMat); createBlock(60, 3, -50, 12, 6, 12, bMat);
    }
    else if (selectedMap === 'inferno') {
        createBlock(0, 4, -40, 80, 8, 10, wMat); createBlock(0, 4, 40, 80, 8, 10, wMat);
        createBlock(-40, 4, 0, 10, 8, 60, wMat); createBlock(40, 4, 0, 10, 8, 60, wMat);
        createBlock(0, 2.5, 0, 8, 5, 8, bMat); 
    }
    else { 
        createBlock(0, 12, 0, 40, 24, 40, wMat); 
        createBlock(-60, 4, 0, 40, 8, 10, bMat); createBlock(60, 4, 0, 40, 8, 10, bMat);
        createBlock(0, 3, 60, 10, 6, 40, bMat); createBlock(0, 3, -60, 10, 6, 40, bMat);
    }
}

function createBlock(x, y, z, w, h, d, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    collidables.push(new THREE.Box3().setFromObject(mesh)); 
    wallMeshes.push(mesh); 
}

function build3DWeapon() {
    while(gunGroup.children.length > 0) gunGroup.remove(gunGroup.children[0]);
    const mDark = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, metalness: 0.7, roughness: 0.4 });
    const mWood = new THREE.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.8 });
    let barrelOffsetZ = -0.45;

    if(currentWeapon === 'ak47') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.45), mDark);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.2), mWood); stock.position.set(0, -0.02, 0.3);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3), mDark); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.01, -0.45);
        gunGroup.add(body, stock, barrel);
    } else if(currentWeapon === 'awp') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.6), new THREE.MeshStandardMaterial({color: 0x243621}));
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25), mDark); scope.rotation.x = Math.PI/2; scope.position.set(0, 0.07, -0.05);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5), mDark); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.02, -0.55);
        barrelOffsetZ = -0.8;
        gunGroup.add(body, scope, barrel);
    } else { 
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.35), mDark);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2), mDark); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0, -0.27);
        barrelOffsetZ = -0.37;
        gunGroup.add(body, barrel);
    }

    // Adiciona o braço/mão do jogador na arma para melhorar o gráfico
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
    document.getElementById('crosshair').style.opacity = (active && currentWeapon === 'awp') ? '0' : '1';
}

function shoot() {
    if(isDead || buyMenuOpen || ammo <= 0) return;
    const now = performance.now(), cfg = weaponsConfig[currentWeapon];
    if (now - lastShotTime < cfg.fireRate) return;

    lastShotTime = now; ammo--; updateHUD();

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

    const hits = ray.intersectObjects(wallMeshes);
    if (hits.length > 0) {
        const hit = hits[0];
        let hitPlayer = false;
        
        if (gameMode === 'bot' && botMesh && (hit.object.parent === botMesh || hit.object === botMesh)) {
            botData.hp -= cfg.damage; hitPlayer = true;
            if (botData.hp <= 0) {
                myScore++; playerMoney += 300; updateHUD(); updateScoreboard();
                showKillFeed("+ $300 (Eliminação)");
                botData.hp = 100;
                botData.pos.copy(getSafeSpawn(camera.position)); 
                botMesh.position.copy(botData.pos);
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
}

// SISTEMA DE DANO REFEITO COM INDICADOR DE IMPACTO E REINÍCIO DE RODADA
function takeDamage(dmg, sourcePos) {
    if (isDead) return;
    hp -= dmg;
    
    document.getElementById('damage-overlay').style.boxShadow = "inset 0 0 200px rgba(255, 0, 0, 0.6)";
    setTimeout(() => document.getElementById('damage-overlay').style.boxShadow = "inset 0 0 150px rgba(255,0,0,0)", 150);
    
    // Calcula o ângulo do hit indicator
    if(sourcePos) {
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
        if(gameMode !== 'bot') broadcastData({ type: 'death' });
        else { 
            enemyScore++; updateScoreboard(); 
            const msg = document.getElementById('round-message');
            msg.innerText = "BOT VENCEU A RODADA";
            msg.style.display = 'block';
        }
        document.exitPointerLock();
        setTimeout(restartRound, 4000);
    }
    updateHUD();
}

// SISTEMA DE REINÍCIO DO ROUND (Como no CS2)
function restartRound() {
    hp = 100; isDead = false;
    playerMoney = 800; // Reset na economia
    currentWeapon = 'deagle'; // Volta para a pistola inicial
    ammo = weaponsConfig.deagle.maxAmmo; reserveAmmo = weaponsConfig.deagle.totalAmmo;
    
    updateHUD();
    build3DWeapon();
    camera.position.copy(getSafeSpawn(null)); 
    
    if (gameMode === 'bot' && botMesh) {
        botData.hp = 100;
        botData.pos.copy(getSafeSpawn(camera.position));
        botMesh.position.copy(botData.pos);
    }
    
    document.getElementById('round-message').style.display = 'none';
    document.body.requestPointerLock();
}

function reload() {
    if (ammo === weaponsConfig[currentWeapon].maxAmmo || reserveAmmo <= 0) return;
    document.getElementById('ammo').innerText = "--";
    setTimeout(() => {
        const cfg = weaponsConfig[currentWeapon];
        const need = cfg.maxAmmo - ammo;
        const add = Math.min(need, reserveAmmo);
        ammo += add; reserveAmmo -= add;
        updateHUD();
    }, 1500);
}

function showKillFeed(txt) {
    const feed = document.getElementById('kill-feed');
    feed.innerText = txt; feed.style.display = 'block';
    setTimeout(() => feed.style.display='none', 2000);
}

// BOT AGORA DÁ STRAFE (ANDA DE LADO) PARA NÃO FICAR PARADO ENQUANTO ATIRA
function updateBotLogic(delta, time) {
    if (gameMode !== 'bot' || !botMesh || isDead) return;
    const dist = botMesh.position.distanceTo(camera.position);
    
    let hasLOS = false;
    const dirToPlayer = new THREE.Vector3().subVectors(camera.position, botMesh.position).normalize();
    const ray = new THREE.Raycaster(new THREE.Vector3().copy(botMesh.position).add(new THREE.Vector3(0,0.8,0)), dirToPlayer);
    const hits = ray.intersectObjects(wallMeshes);
    if (hits.length === 0 || hits[0].distance >= dist - 1.5) hasLOS = true;

    botMesh.lookAt(camera.position.x, botMesh.position.y, camera.position.z);

    if (hasLOS && dist < 45) {
        // Atirando
        if (time - botData.lastShot > 600) { botData.lastShot = time; if (Math.random() > 0.4) takeDamage(14, botMesh.position); }
        
        // Strafing Esquerda/Direita para não ficar parado
        const strafeVetor = new THREE.Vector3().crossVectors(dirToPlayer, new THREE.Vector3(0,1,0)).normalize();
        const oldPos = botMesh.position.clone();
        botMesh.position.addScaledVector(strafeVetor, 3.5 * botData.strafeDir * delta);
        
        botBox.setFromCenterAndSize(botMesh.position, new THREE.Vector3(1.2, 1.8, 1.2));
        for (let box of collidables) {
            if (botBox.intersectsBox(box)) { botMesh.position.copy(oldPos); botData.strafeDir *= -1; break; }
        }
        if (Math.random() < 0.01) botData.strafeDir *= -1; // Muda de direção aleatoriamente
    } else {
        const oldPos = botMesh.position.clone();
        const moveVetor = new THREE.Vector3();
        botMesh.getWorldDirection(moveVetor); moveVetor.y = 0; moveVetor.normalize();

        botMesh.position.addScaledVector(moveVetor, 7.0 * delta); 
        
        botBox.setFromCenterAndSize(botMesh.position, new THREE.Vector3(1.2, 1.8, 1.2));
        let collides = false;
        for (let box of collidables) {
            if (botBox.intersectsBox(box)) { collides = true; break; }
        }
        
        if (collides) {
            botMesh.position.copy(oldPos);
            botMesh.translateX(1.0 * botData.strafeDir); 
            botData.strafeDir *= -1;
        }
    }
    botData.pos.copy(botMesh.position);
}

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now(), delta = Math.min((time - prevTime) / 1000, 0.1);

    if (pointerLocked && !isDead && !buyMenuOpen) {
        const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
        const camRight = new THREE.Vector3().crossVectors(camDir, camera.up).normalize();

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 4.5 * delta;

        let speed = isCrouching ? 25 : (isRunning ? 100 : 65);
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
    }

    camera.fov += ((isAiming ? weaponsConfig[currentWeapon].zoomFov || 50 : 80) - camera.fov) * 15 * delta;
    camera.updateProjectionMatrix();

    updateBotLogic(delta, time);

    if (gameMode !== 'bot' && time - lastSentTime > 40) {
        broadcastData({ type: 'pos_update', x: camera.position.x, y: camera.position.y, z: camera.position.z, ry: cameraEuler.y });
        lastSentTime = time;
    }

    prevTime = time;
    renderer.render(scene, camera);
}
