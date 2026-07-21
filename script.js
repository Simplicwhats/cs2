let gameMode = 'bot';
let botActive = true;
let peer, conn, isHost = true, networkReady = false;
let playerNick = "Player_1";
let selectedMap = "dust2";
let playerMoney = 800;

// CONFIGURAÇÃO TÁTICA DAS ARMAS (ESTILO CS2)
const weaponsConfig = {
    deagle: { name: "Desert Eagle", damage: 55, fireRate: 400, maxAmmo: 7, totalAmmo: 35, spread: 0.012, recoil: 0.04, price: 700 },
    p90:    { name: "P90", damage: 22, fireRate: 70, maxAmmo: 50, totalAmmo: 100, spread: 0.025, recoil: 0.012, price: 2350 },
    ak47:   { name: "AK-47", damage: 36, fireRate: 100, maxAmmo: 30, totalAmmo: 90, spread: 0.018, recoil: 0.022, price: 2700 },
    m4a4:   { name: "M4A4", damage: 28, fireRate: 88, maxAmmo: 30, totalAmmo: 90, spread: 0.014, recoil: 0.016, price: 3100 },
    awp:    { name: "AWP", damage: 115, fireRate: 1300, maxAmmo: 5, totalAmmo: 30, spread: 0.001, recoil: 0.09, price: 4750, zoomFov: 25 }
};

let currentWeapon = 'ak47';
let lastShotTime = 0;
let isAiming = false;
let pointerLocked = false;
let buyMenuOpen = false;

// UI
const btnStart = document.getElementById('btn-start');
const netLinkSection = document.getElementById('net-link-section');
const container = document.getElementById('canvas-container');
const pauseScreen = document.getElementById('pause-screen');
const btnResume = document.getElementById('btn-resume');
const buyMenu = document.getElementById('buy-menu');

// Inicialização de Rede P2P
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const spawnPoints = [{ x: -50, z: 50 }, { x: 50, z: -50 }, { x: -50, z: -50 }, { x: 50, z: 50 }];

if (roomId) {
    isHost = false; botActive = false; gameMode = 'p2p';
    document.getElementById('mode-p2p').classList.add('active');
    document.getElementById('mode-bot').classList.remove('active');
    netLinkSection.style.display = 'block';
    netLinkSection.innerHTML = "<b style='color:#ff9d00;'>Conectando ao servidor...</b>";
    initP2P(null, roomId);
} else {
    const generatedRoom = Math.random().toString(36).substring(2, 8);
    initP2P(generatedRoom);
    document.getElementById('lobby-link').value = `${window.location.href.split('?')[0]}?room=${generatedRoom}`;
}

function setGameMode(mode) {
    gameMode = mode;
    if(mode === 'bot') {
        botActive = true; isHost = true;
        document.getElementById('mode-bot').classList.add('active');
        document.getElementById('mode-p2p').classList.remove('active');
        netLinkSection.style.display = 'none';
        btnStart.disabled = false;
    } else {
        botActive = false;
        document.getElementById('mode-p2p').classList.add('active');
        document.getElementById('mode-bot').classList.remove('active');
        netLinkSection.style.display = 'block';
        if(!networkReady) btnStart.disabled = true;
    }
}

function initP2P(hostRoomId, targetRoomId) {
    const configPeer = { host: '0.peerjs.com', port: 443, path: '/', secure: true };
    if (!targetRoomId) {
        peer = new Peer(hostRoomId, configPeer);
        peer.on('connection', (c) => { conn = c; setupConnection(); });
    } else {
        peer = new Peer(configPeer);
        peer.on('open', () => { conn = peer.connect(targetRoomId); setupConnection(); });
    }
}

function setupConnection() {
    conn.on('open', () => {
        networkReady = true; btnStart.disabled = false;
        netLinkSection.innerHTML = "<b style='color:#00ff88;'>ADVERSÁRIO PRONTO!</b>";
    });
    conn.on('data', handleNetworkData);
}

// --- ENGINE E CENA ---
let scene, camera, renderer, prevTime = performance.now();
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, canJump = true;
let isRunning = false, isCrouching = false;
let currentHeight = 1.8;
const velocity = new THREE.Vector3();
let hp = 100, ammo = 30, reserveAmmo = 90, myScore = 0, enemyScore = 0, isReloading = false, isDead = false;
let gunGroup, muzzleFlashLight, enemyMesh;
let collidables = []; 
let targetMeshes = []; 
const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
let lastSentTime = 0;

let botData = { position: new THREE.Vector3(20, 1.2, -20), hp: 100, lastShot: 0, state: 'patrol' };
let playerBox = new THREE.Box3(), botBox = new THREE.Box3();

// INICIAR JOGO
btnStart.addEventListener('click', () => {
    playerNick = document.getElementById('player-nick').value || "Player";
    selectedMap = document.getElementById('map-select').value;
    document.getElementById('display-my-name').innerText = playerNick.toUpperCase();
    
    if (gameMode === 'p2p' && networkReady) conn.send({ type: 'start_game', nick: playerNick });
    
    document.getElementById('lobby-container').style.display = 'none';
    container.style.display = 'block';
    document.getElementById('hud').style.display = 'flex';
    document.getElementById('scoreboard').style.display = 'flex';
    document.getElementById('buy-hint').style.display = 'block';
    document.getElementById('crosshair').style.display = 'block';
    
    updateHUD();
    initGameEngine();
    animate();
    document.body.requestPointerLock();
});

btnResume.addEventListener('click', () => { document.body.requestPointerLock(); });

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) {
        pointerLocked = true;
        pauseScreen.style.display = 'none';
        if(buyMenuOpen) toggleBuyMenu(false);
    } else {
        pointerLocked = false;
        if(!buyMenuOpen) pauseScreen.style.display = 'flex';
        moveForward = moveBackward = moveLeft = moveRight = false; 
    }
});

// SISTEMA DE COMPRAS CS2
function toggleBuyMenu(show) {
    buyMenuOpen = show;
    if(buyMenuOpen) {
        document.exitPointerLock();
        document.getElementById('buy-money-display').innerText = `$${playerMoney}`;
        buyMenu.classList.remove('hidden');
    } else {
        buyMenu.classList.add('hidden');
        if(!pointerLocked && !isDead) document.body.requestPointerLock();
    }
}

function buyWeapon(key) {
    const weap = weaponsConfig[key];
    if(playerMoney >= weap.price) {
        playerMoney -= weap.price;
        currentWeapon = key;
        ammo = weap.maxAmmo;
        reserveAmmo = weap.totalAmmo;
        updateHUD();
        build3DWeapon();
        toggleBuyMenu(false);
    } else {
        alert("Saldo Insuficiente!");
    }
}

function updateHUD() {
    document.getElementById('hp').innerText = hp;
    document.getElementById('money-display').innerText = `$${playerMoney}`;
    document.getElementById('ammo').innerText = `${ammo} / ${reserveAmmo}`;
    document.getElementById('weapon-display').innerText = weaponsConfig[currentWeapon].name;
}

function handleNetworkData(data) {
    if (botActive) return;
    if (data.type === 'pos_update' && enemyMesh) {
        enemyMesh.position.set(data.x, data.y, data.z);
        enemyMesh.rotation.y = data.ry;
    }
    if (data.type === 'hit') takeDamage(data.damage);
    if (data.type === 'death') {
        showKillFeed("Você eliminou o inimigo!");
        myScore++;
        playerMoney += 300;
        updateHUD();
        updateScoreboardHTML();
    }
}

function updateScoreboardHTML() {
    document.getElementById('score-player').innerText = myScore;
    document.getElementById('score-enemy').innerText = enemyScore;
}

// PROCEDURAL TEXTURES
function createTexture(colorBase, colorDetail, type) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colorBase; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = colorDetail;
    for(let i=0; i<400; i++) {
        let x = Math.random()*256, y = Math.random()*256;
        ctx.fillRect(x, y, 2, 2);
    }
    if(type === 'grid') {
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 2;
        for(let i=0; i<256; i+=32) { ctx.strokeRect(0, i, 256, 32); ctx.strokeRect(i, 0, 32, 256); }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(20, 20);
    return tex;
}

// INICIALIZADOR DE MOTOR TÁTICO CS2
function initGameEngine() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(selectedMap === 'dust2' ? 0xd4b28c : (selectedMap === 'mirage' ? 0x99aab5 : 0x778899));
    scene.fog = new THREE.FogExp2(scene.background, 0.005);

    camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(isHost ? -40 : 40, 1.8, 40);

    // ILUMINAÇÃO CS2
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.2);
    dirLight.position.set(100, 150, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    muzzleFlashLight = new THREE.PointLight(0xffaa00, 0, 10);
    scene.add(muzzleFlashLight);

    // CONSTRUÇÃO DO MAPA SELECIONADO
    collidables = []; targetMeshes = [];
    buildMap(selectedMap);

    // MODELO DO INIMIGO
    enemyMesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 16), new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.4 }));
    body.position.y = 0.9; body.castShadow = true; enemyMesh.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffccaa }));
    head.position.y = 1.8; head.castShadow = true; enemyMesh.add(head);
    enemyMesh.position.copy(botData.position);
    scene.add(enemyMesh);
    targetMeshes.push(body, head);

    // GRUPO DE ARMAS
    gunGroup = new THREE.Group();
    camera.add(gunGroup);
    scene.add(camera);
    build3DWeapon();

    // INPUTS E CONTROLES
    document.addEventListener('mousemove', (e) => {
        if (!pointerLocked || isDead || buyMenuOpen) return;
        const sensitivity = isAiming ? 0.0008 : 0.0018;
        cameraEuler.y -= e.movementX * sensitivity;
        cameraEuler.x -= e.movementY * sensitivity;
        cameraEuler.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, cameraEuler.x));
        camera.quaternion.setFromEuler(cameraEuler);
    });

    document.addEventListener('keydown', (e) => {
        if (isDead) return;
        if (e.code === 'KeyB') toggleBuyMenu(!buyMenuOpen);
        if (!pointerLocked || buyMenuOpen) return;
        switch(e.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyD': moveRight = true; break;
            case 'ShiftLeft': isRunning = true; break;
            case 'ControlLeft': isCrouching = true; currentHeight = 1.0; break;
            case 'Space': if(canJump) { velocity.y = 9; canJump = false; } break;
            case 'KeyR': reload(); break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch(e.code) {
            case 'KeyW': moveForward = false; break;
            case 'KeyS': moveBackward = false; break;
            case 'KeyA': moveLeft = false; break;
            case 'KeyD': moveRight = false; break;
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

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// GERADORES DE MAPA
function buildMap(type) {
    let floorMat, wallMat, boxMat;

    if(type === 'dust2') {
        floorMat = new THREE.MeshStandardMaterial({ map: createTexture('#d4b28c', '#b5936e', 'sand'), roughness: 0.9 });
        wallMat = new THREE.MeshStandardMaterial({ map: createTexture('#caba94', '#9e8e6b', 'grid'), roughness: 0.8 });
        boxMat = new THREE.MeshStandardMaterial({ map: createTexture('#8a6842', '#594126', 'grid'), roughness: 0.6 });
    } else if(type === 'mirage') {
        floorMat = new THREE.MeshStandardMaterial({ map: createTexture('#7d807d', '#575957', 'sand'), roughness: 0.7 });
        wallMat = new THREE.MeshStandardMaterial({ map: createTexture('#bd9b79', '#967454', 'grid'), roughness: 0.8 });
        boxMat = new THREE.MeshStandardMaterial({ color: 0x3d5a80, roughness: 0.5 });
    } else { // inferno
        floorMat = new THREE.MeshStandardMaterial({ map: createTexture('#525252', '#333333', 'grid'), roughness: 0.8 });
        wallMat = new THREE.MeshStandardMaterial({ map: createTexture('#8a4336', '#592920', 'grid'), roughness: 0.9 });
        boxMat = new THREE.MeshStandardMaterial({ color: 0x4a5d4e, roughness: 0.5 });
    }

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    scene.add(floor);

    // LIMITES
    createBlock(0, 5, -100, 200, 10, 2, wallMat);
    createBlock(0, 5, 100, 200, 10, 2, wallMat);
    createBlock(-100, 5, 0, 2, 10, 200, wallMat);
    createBlock(100, 5, 0, 2, 10, 200, wallMat);

    // ESTRUTURAS TÁTICAS DO MAPA
    createBlock(0, 4, 0, 30, 8, 30, wallMat); // Centro
    createBlock(-40, 3, 20, 12, 6, 12, boxMat);
    createBlock(40, 3, -20, 12, 6, 12, boxMat);
    createBlock(-20, 2, -50, 8, 4, 16, boxMat);
    createBlock(20, 2, 50, 8, 4, 16, boxMat);
}

function createBlock(x, y, z, w, h, d, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    collidables.push(new THREE.Box3().setFromObject(mesh));
    targetMeshes.push(mesh);
}

// MODELAGEM DETALHADA DAS ARMAS 3D CS2
function build3DWeapon() {
    while(gunGroup.children.length > 0) gunGroup.remove(gunGroup.children[0]);

    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.3 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.7 });

    if(currentWeapon === 'ak47') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.5), darkMat);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.25), woodMat); stock.position.set(0, -0.01, 0.35);
        const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.06, 0.2), woodMat); handguard.position.set(0, -0.01, -0.25);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3), darkMat); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.01, -0.45);
        gunGroup.add(body, stock, handguard, barrel);
    } else if(currentWeapon === 'awp') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.7), new THREE.MeshStandardMaterial({ color: 0x2b422a }));
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3), darkMat); scope.rotation.x = Math.PI/2; scope.position.set(0, 0.08, -0.05);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5), darkMat); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.02, -0.55);
        gunGroup.add(body, scope, barrel);
    } else { // Deagle / M4 / P90
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.45), darkMat);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25), darkMat); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.01, -0.3);
        gunGroup.add(body, barrel);
    }
    gunGroup.position.set(0.2, -0.2, -0.4);
}

function setAim(active) {
    if(isDead || buyMenuOpen) return;
    isAiming = active;
    document.getElementById('crosshair').style.opacity = (active && currentWeapon === 'awp') ? '0' : '1';
}

function shoot() {
    if(isDead || buyMenuOpen || isReloading) return;
    const now = performance.now();
    const config = weaponsConfig[currentWeapon];
    if (now - lastShotTime < config.fireRate || ammo <= 0) return;

    lastShotTime = now; ammo--;
    updateHUD();

    // RECUO E ANIMAÇÃO
    gunGroup.position.z += 0.08; setTimeout(() => gunGroup.position.z -= 0.08, 40);
    cameraEuler.x += config.recoil; cameraEuler.y += (Math.random() - 0.5) * config.recoil * 0.4;
    camera.quaternion.setFromEuler(cameraEuler);

    // EFEITO DE LUZ DO TIRO (MUZZLE FLASH)
    muzzleFlashLight.position.copy(camera.position);
    muzzleFlashLight.intensity = 2.0;
    setTimeout(() => muzzleFlashLight.intensity = 0, 40);

    // RAYCASTING DO DISPARO
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0,0), camera);
    let spread = config.spread * (isAiming ? 0.5 : 1.5);
    ray.ray.direction.x += (Math.random() - 0.5) * spread;
    ray.ray.direction.y += (Math.random() - 0.5) * spread;

    const hits = ray.intersectObjects(targetMeshes);
    if (hits.length > 0) {
        const hit = hits[0];
        spawnImpactParticle(hit.point);
        
        if (hit.object.parent === enemyMesh || hit.object === enemyMesh) {
            if (botActive) botTakeDamage(config.damage);
            else conn.send({ type: 'hit', damage: config.damage });
        }
    }
}

function spawnImpactParticle(pos) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    p.position.copy(pos); scene.add(p);
    setTimeout(() => scene.remove(p), 150);
}

function botTakeDamage(dmg) {
    botData.hp -= dmg;
    if (botData.hp <= 0) {
        showKillFeed("Inimigo Eliminado! +$300");
        myScore++; playerMoney += 300;
        updateHUD(); updateScoreboardHTML();
        botData.hp = 100;
        const randomSpawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
        botData.position.set(randomSpawn.x, 1.2, randomSpawn.z);
        enemyMesh.position.copy(botData.position);
    }
}

function takeDamage(dmg) {
    if (isDead) return;
    hp -= dmg; if (hp <= 0) {
        hp = 0; isDead = true;
        enemyScore++; updateScoreboardHTML();
        showKillFeed("Você foi Eliminado!");
        if(!botActive) conn.send({type: 'death'});
        document.exitPointerLock();
        setTimeout(respawnPlayer, 3000);
    }
    updateHUD();
}

function respawnPlayer() {
    hp = 100; isDead = false;
    const config = weaponsConfig[currentWeapon];
    ammo = config.maxAmmo; reserveAmmo = config.totalAmmo;
    updateHUD();
    const randomSpawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    camera.position.set(randomSpawn.x, 1.8, randomSpawn.z);
    velocity.set(0,0,0);
    document.body.requestPointerLock();
}

function reload() {
    if (isReloading || ammo === weaponsConfig[currentWeapon].maxAmmo || reserveAmmo <= 0) return;
    isReloading = true;
    document.getElementById('ammo').innerText = "RECARREGANDO...";
    setTimeout(() => {
        const config = weaponsConfig[currentWeapon];
        const needed = config.maxAmmo - ammo;
        const toAdd = Math.min(needed, reserveAmmo);
        ammo += toAdd; reserveAmmo -= toAdd;
        updateHUD(); isReloading = false;
    }, 1500);
}

function updateBotLogic(delta) {
    if (!botActive || isDead) return;
    const dist = botData.position.distanceTo(camera.position);
    enemyMesh.lookAt(camera.position.x, enemyMesh.position.y, camera.position.z);

    if (dist < 30) {
        const time = performance.now();
        if (time - botData.lastShot > 700) {
            botData.lastShot = time;
            if (Math.random() > 0.4) takeDamage(12);
        }
    } else {
        enemyMesh.translateZ(4.0 * delta);
        botData.position.copy(enemyMesh.position);
    }
}

function showKillFeed(text) {
    const feed = document.getElementById('kill-feed');
    feed.innerText = text; feed.style.display = 'block';
    setTimeout(() => feed.style.display = 'none', 3000);
}

// LOOP PRINCIPAL
function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = Math.min((time - prevTime) / 1000, 0.1);

    if (pointerLocked && !isDead && !buyMenuOpen) {
        const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
        const camRight = new THREE.Vector3().crossVectors(camera.up, camDir).normalize();

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 4.5 * delta;

        let speed = isCrouching ? 30 : (isRunning ? 110 : 70);
        if (moveForward) velocity.addScaledVector(camDir, speed * delta);
        if (moveBackward) velocity.addScaledVector(camDir, -speed * delta);
        if (moveLeft) velocity.addScaledVector(camRight, -speed * delta);
        if (moveRight) velocity.addScaledVector(camRight, speed * delta);

        const oldPos = camera.position.clone();
        camera.position.addScaledVector(velocity, delta);

        // COLISÃO COM OBSTÁCULOS
        playerBox.setFromCenterAndSize(camera.position, new THREE.Vector3(0.8, 1.8, 0.8));
        for (let box of collidables) {
            if (playerBox.intersectsBox(box)) {
                camera.position.copy(oldPos); velocity.set(0, 0, 0); break;
            }
        }

        if (camera.position.y < currentHeight) {
            camera.position.y = currentHeight; velocity.y = 0; canJump = true;
        }
    }

    // FOV / ADS DE MIRA
    const targetFov = isAiming ? (weaponsConfig[currentWeapon].zoomFov || 50) : 80;
    camera.fov += (targetFov - camera.fov) * 15 * delta;
    camera.updateProjectionMatrix();

    // ATUALIZAÇÃO REDE E IA
    updateBotLogic(delta);
    if (networkReady && !botActive && time - lastSentTime > 35) {
        conn.send({ type: 'pos_update', x: camera.position.x, y: camera.position.y, z: camera.position.z, ry: cameraEuler.y });
        lastSentTime = time;
    }

    prevTime = time;
    renderer.render(scene, camera);
}
