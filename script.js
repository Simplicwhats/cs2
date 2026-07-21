let gameMode = 'bot';
let botActive = true;
let peer, conn, isHost = true, networkReady = false;
let playerNick = "Striker", selectedMap = "dust2";
let playerMoney = 800;

// Configuração Balanceada (Estilo CS2)
const weaponsConfig = {
    deagle: { name: "Desert Eagle", damage: 60, fireRate: 350, maxAmmo: 7, totalAmmo: 35, spread: 0.012, recoil: 0.06, price: 700 },
    p90:    { name: "P90", damage: 22, fireRate: 70, maxAmmo: 50, totalAmmo: 100, spread: 0.03, recoil: 0.015, price: 2350 },
    ak47:   { name: "AK-47", damage: 36, fireRate: 100, maxAmmo: 30, totalAmmo: 90, spread: 0.018, recoil: 0.025, price: 2700 },
    m4a4:   { name: "M4A4", damage: 28, fireRate: 88, maxAmmo: 30, totalAmmo: 90, spread: 0.014, recoil: 0.018, price: 3100 },
    awp:    { name: "AWP", damage: 115, fireRate: 1300, maxAmmo: 5, totalAmmo: 30, spread: 0.001, recoil: 0.1, price: 4750, zoomFov: 20 }
};

let currentWeapon = 'ak47';
let lastShotTime = 0, isAiming = false, pointerLocked = false, buyMenuOpen = false;

// Elementos da UI
const btnStart = document.getElementById('btn-start');
const container = document.getElementById('canvas-container');
const pauseScreen = document.getElementById('pause-screen');
const buyMenu = document.getElementById('buy-menu');

const spawnPoints = [{ x: -40, z: 40 }, { x: 40, z: -40 }, { x: -40, z: -40 }, { x: 40, z: 40 }];

// Setup P2P Básico
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('room')) {
    isHost = false; botActive = false; gameMode = 'p2p';
    document.getElementById('mode-p2p').classList.add('active');
    document.getElementById('mode-bot').classList.remove('active');
    document.getElementById('net-link-section').style.display = 'block';
    initP2P(null, urlParams.get('room'));
} else {
    const room = Math.random().toString(36).substring(2, 8);
    initP2P(room);
    document.getElementById('lobby-link').value = `${window.location.href.split('?')[0]}?room=${room}`;
}

function setGameMode(mode) {
    gameMode = mode;
    botActive = (mode === 'bot'); isHost = true;
    document.getElementById('mode-bot').classList.toggle('active', botActive);
    document.getElementById('mode-p2p').classList.toggle('active', !botActive);
    document.getElementById('net-link-section').style.display = botActive ? 'none' : 'block';
    btnStart.disabled = (!botActive && !networkReady);
}

function initP2P(hostRoomId, targetRoomId) {
    const configPeer = { host: '0.peerjs.com', port: 443, path: '/', secure: true };
    peer = new Peer(hostRoomId || undefined, configPeer);
    if(hostRoomId) peer.on('connection', (c) => { conn = c; conn.on('open', ()=> { networkReady=true; btnStart.disabled=false; }); });
    else peer.on('open', () => { conn = peer.connect(targetRoomId); conn.on('open', ()=> { networkReady=true; btnStart.disabled=false; }); });
}

// VARIÁVEIS DA ENGINE
let scene, camera, renderer, prevTime = performance.now();
let moveF = false, moveB = false, moveL = false, moveR = false, canJump = true;
let isRunning = false, isCrouching = false;
let velocity = new THREE.Vector3(), currentHeight = 1.8;
let hp = 100, ammo = 30, reserveAmmo = 90, myScore = 0, enemyScore = 0, isDead = false;
let gunGroup, muzzleFlashMesh, muzzleLight, enemyMesh;
let collidables = [], wallMeshes = []; // Separado para Colisão e Visão(Tiro)
const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
let recoilOffset = 0; // Para recuperar a mira
let botData = { pos: new THREE.Vector3(20, 1.2, -20), hp: 100, lastShot: 0 };
let playerBox = new THREE.Box3(), botBox = new THREE.Box3();

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
    if (pointerLocked) {
        pauseScreen.style.display = 'none';
        if(buyMenuOpen) toggleBuyMenu(false);
    } else {
        moveF = moveB = moveL = moveR = false;
        if(!buyMenuOpen) pauseScreen.style.display = 'flex';
    }
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

// TEXTURAS COM MAIS DETALHES
function createNoiseTexture(baseColor, noiseColor, type) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = baseColor; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = noiseColor;
    for(let i=0; i<3000; i++) {
        ctx.globalAlpha = Math.random() * 0.5;
        ctx.fillRect(Math.random()*512, Math.random()*512, Math.random()*3+1, Math.random()*3+1);
    }
    if(type === 'grid') {
        ctx.globalAlpha = 0.3; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
        for(let i=0; i<512; i+=64) { ctx.strokeRect(0, i, 512, 64); ctx.strokeRect(i, 0, 64, 512); }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(15, 15);
    return tex;
}

// INICIALIZADOR DA ENGINE
function initGameEngine() {
    scene = new THREE.Scene();
    
    // Configuração de Clima/Céu baseada no mapa
    let bgColor = selectedMap === 'dust2' ? 0xdeceaa : (selectedMap === 'mirage' ? 0xaecce8 : 0x7c8c9e);
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.FogExp2(bgColor, 0.006);

    camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.8, 30);

    // Iluminação Profissional
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    hemiLight.position.set(0, 100, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    dirLight.position.set(60, 100, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    buildMap();

    // IA / INIMIGO
    enemyMesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 16), new THREE.MeshStandardMaterial({ color: 0xb33939, roughness: 0.6 }));
    body.position.y = 0.9; body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshStandardMaterial({ color: 0xeccbcb }));
    head.position.y = 1.9; head.castShadow = true;
    enemyMesh.add(body, head);
    enemyMesh.position.copy(botData.pos);
    scene.add(enemyMesh);
    wallMeshes.push(body, head); // Adiciona corpo para receber tiros

    // ARMA E MUZZLE FLASH
    gunGroup = new THREE.Group();
    camera.add(gunGroup); scene.add(camera);
    build3DWeapon();

    // INPUTS
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
            case 'Space': if(canJump) { velocity.y = 8; canJump = false; } break;
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

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
}

function buildMap() {
    let fMat, wMat, bMat;
    if(selectedMap === 'dust2') {
        fMat = new THREE.MeshStandardMaterial({ map: createNoiseTexture('#d4b28c', '#a6825c', 'sand'), roughness: 1.0 });
        wMat = new THREE.MeshStandardMaterial({ map: createNoiseTexture('#caba94', '#9e8e6b', 'grid'), roughness: 0.9 });
        bMat = new THREE.MeshStandardMaterial({ map: createNoiseTexture('#7d5836', '#4a321d', 'grid'), roughness: 0.7 });
    } else if(selectedMap === 'mirage') {
        fMat = new THREE.MeshStandardMaterial({ map: createNoiseTexture('#9da39d', '#6e756e', 'sand'), roughness: 0.8 });
        wMat = new THREE.MeshStandardMaterial({ map: createNoiseTexture('#c7a481', '#947252', 'grid'), roughness: 0.9 });
        bMat = new THREE.MeshStandardMaterial({ color: 0x435c75, roughness: 0.6 });
    } else {
        fMat = new THREE.MeshStandardMaterial({ map: createNoiseTexture('#4a4a4a', '#2b2b2b', 'grid'), roughness: 0.8 });
        wMat = new THREE.MeshStandardMaterial({ map: createNoiseTexture('#8a4336', '#54261e', 'grid'), roughness: 0.9 });
        bMat = new THREE.MeshStandardMaterial({ color: 0x546b5a, roughness: 0.6 });
    }

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), fMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    createBlock(0, 5, -120, 240, 10, 2, wMat);
    createBlock(0, 5, 120, 240, 10, 2, wMat);
    createBlock(-120, 5, 0, 2, 10, 240, wMat);
    createBlock(120, 5, 0, 2, 10, 240, wMat);

    // Layout
    createBlock(0, 4, 0, 24, 8, 24, wMat); // Meio
    createBlock(-40, 3, 30, 10, 6, 10, bMat);
    createBlock(40, 3, -30, 10, 6, 10, bMat);
    createBlock(-20, 2, -60, 6, 4, 12, bMat);
    createBlock(20, 2, 60, 6, 4, 12, bMat);
}

function createBlock(x, y, z, w, h, d, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    collidables.push(new THREE.Box3().setFromObject(mesh)); // Física
    wallMeshes.push(mesh); // Visão/Tiro
}

function build3DWeapon() {
    while(gunGroup.children.length > 0) gunGroup.remove(gunGroup.children[0]);
    
    const mDark = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, metalness: 0.7, roughness: 0.4 });
    const mWood = new THREE.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.8 });

    let barrelOffsetZ = -0.45;

    if(currentWeapon === 'ak47') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.45), mDark);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.2), mWood); stock.position.set(0, -0.02, 0.3);
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.05, 0.18), mWood); hand.position.set(0, -0.01, -0.2);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3), mDark); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.01, -0.45);
        gunGroup.add(body, stock, hand, barrel);
    } else if(currentWeapon === 'awp') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.6), new THREE.MeshStandardMaterial({color: 0x243621}));
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25), mDark); scope.rotation.x = Math.PI/2; scope.position.set(0, 0.07, -0.05);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4), mDark); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.02, -0.5);
        barrelOffsetZ = -0.7;
        gunGroup.add(body, scope, barrel);
    } else { 
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.4), mDark);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2), mDark); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0, -0.3);
        barrelOffsetZ = -0.4;
        gunGroup.add(body, barrel);
    }

    // Sistema de Muzzle Flash
    muzzleFlashMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, 0.2), 
        new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0, depthWrite: false })
    );
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

    // Animação de Recuo Visual
    gunGroup.position.z += 0.06; setTimeout(() => gunGroup.position.z -= 0.06, 50);
    
    // Muzzle Flash
    muzzleFlashMesh.material.opacity = 1.0;
    muzzleFlashMesh.rotation.z = Math.random() * Math.PI;
    muzzleLight.intensity = 3.0;
    setTimeout(() => { muzzleFlashMesh.material.opacity = 0; muzzleLight.intensity = 0; }, 40);

    // Recuo Funcional da Câmera
    recoilOffset += cfg.recoil;
    cameraEuler.x += cfg.recoil;
    cameraEuler.y += (Math.random() - 0.5) * cfg.recoil * 0.5;
    camera.quaternion.setFromEuler(cameraEuler);

    // Raycast (Tiro)
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0,0), camera);
    let spr = cfg.spread * (isAiming ? 0.3 : (Math.abs(velocity.x)>1 ? 2.5 : 1.0));
    ray.ray.direction.x += (Math.random() - 0.5) * spr;
    ray.ray.direction.y += (Math.random() - 0.5) * spr;

    const hits = ray.intersectObjects(wallMeshes);
    if (hits.length > 0) {
        const hit = hits[0];
        if (hit.object.parent === enemyMesh || hit.object === enemyMesh) {
            botTakeDamage(cfg.damage);
        } else {
            // Marca na parede
            const spark = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), new THREE.MeshBasicMaterial({color: 0xffdd88}));
            spark.position.copy(hit.point); scene.add(spark);
            setTimeout(() => scene.remove(spark), 100);
        }
    }
}

function botTakeDamage(dmg) {
    botData.hp -= dmg;
    if (botData.hp <= 0) {
        myScore++; playerMoney += 300; updateHUD();
        document.getElementById('score-player').innerText = myScore;
        document.getElementById('kill-feed').innerText = "+ $300 (Eliminação)";
        document.getElementById('kill-feed').style.display = 'block';
        setTimeout(() => document.getElementById('kill-feed').style.display='none', 2000);
        
        botData.hp = 100;
        const resp = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
        enemyMesh.position.set(resp.x, 1.2, resp.z);
    }
}

function takeDamage(dmg) {
    if (isDead) return;
    hp -= dmg;
    
    // Efeito de Sangue
    const overlay = document.getElementById('damage-overlay');
    overlay.style.boxShadow = "inset 0 0 200px rgba(255, 0, 0, 0.6)";
    setTimeout(() => overlay.style.boxShadow = "inset 0 0 150px rgba(255, 0, 0, 0)", 150);
    
    if (hp <= 0) {
        hp = 0; isDead = true; enemyScore++;
        document.getElementById('score-enemy').innerText = enemyScore;
        document.exitPointerLock();
        setTimeout(() => {
            hp = 100; isDead = false; ammo = weaponsConfig[currentWeapon].maxAmmo;
            updateHUD();
            const resp = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
            camera.position.set(resp.x, 1.8, resp.z);
            document.body.requestPointerLock();
        }, 3000);
    }
    updateHUD();
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

// IA TÁTICA AVANÇADA (Visão e Colisão)
function updateBotLogic(delta, time) {
    if (!botActive || isDead) return;
    const dist = enemyMesh.position.distanceTo(camera.position);
    
    // Verifica Linha de Visão (Raycast Bot -> Player)
    let hasLOS = false;
    const dirToPlayer = new THREE.Vector3().subVectors(camera.position, enemyMesh.position).normalize();
    const ray = new THREE.Raycaster(new THREE.Vector3().copy(enemyMesh.position).add(new THREE.Vector3(0,0.8,0)), dirToPlayer);
    const hits = ray.intersectObjects(wallMeshes);
    
    // Se o raio não bater em nada antes de chegar no player (distância)
    if (hits.length === 0 || hits[0].distance >= dist - 1.5) {
        hasLOS = true;
    }

    enemyMesh.lookAt(camera.position.x, enemyMesh.position.y, camera.position.z);

    if (hasLOS && dist < 45) {
        // Atirando
        if (time - botData.lastShot > 600) {
            botData.lastShot = time;
            if (Math.random() > 0.4) takeDamage(15);
        }
    } else {
        // Andando
        const oldPos = enemyMesh.position.clone();
        enemyMesh.translateZ(7.0 * delta); // Move pra frente
        
        // Verifica Colisão do Bot
        botBox.setFromCenterAndSize(enemyMesh.position, new THREE.Vector3(1.0, 1.8, 1.0));
        let collides = false;
        for (let box of collidables) {
            if (botBox.intersectsBox(box)) { collides = true; break; }
        }
        
        if (collides) {
            enemyMesh.position.copy(oldPos);
            enemyMesh.position.x += (Math.random() - 0.5) * 2; // Desvia
            enemyMesh.position.z += (Math.random() - 0.5) * 2;
        }
    }
    botData.pos.copy(enemyMesh.position);
}

// LOOP
function animate() {
    requestAnimationFrame(animate);
    const time = performance.now(), delta = Math.min((time - prevTime) / 1000, 0.1);

    if (pointerLocked && !isDead && !buyMenuOpen) {
        const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
        
        // CORREÇÃO DOS CONTROLES A/D: Cross (Direção, Cima) = Direita
        const camRight = new THREE.Vector3().crossVectors(camDir, camera.up).normalize();

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 4.5 * delta;

        let speed = isCrouching ? 25 : (isRunning ? 100 : 65);
        if(isAiming) speed *= 0.5;

        if (moveF) velocity.addScaledVector(camDir, speed * delta);
        if (moveB) velocity.addScaledVector(camDir, -speed * delta);
        if (moveL) velocity.addScaledVector(camRight, -speed * delta); // Esquerda
        if (moveR) velocity.addScaledVector(camRight, speed * delta);  // Direita

        const oldPos = camera.position.clone();
        camera.position.addScaledVector(velocity, delta);

        playerBox.setFromCenterAndSize(camera.position, new THREE.Vector3(0.6, 1.8, 0.6));
        for (let box of collidables) {
            if (playerBox.intersectsBox(box)) { camera.position.copy(oldPos); velocity.set(0, 0, 0); break; }
        }

        if (camera.position.y < currentHeight) { camera.position.y = currentHeight; velocity.y = 0; canJump = true; }

        // Recuo Recovery (A câmera desce de volta devagar se não estiver atirando)
        if (recoilOffset > 0 && (time - lastShotTime > 150)) {
            const recAmt = Math.min(recoilOffset, 1.5 * delta);
            cameraEuler.x -= recAmt; recoilOffset -= recAmt;
            camera.quaternion.setFromEuler(cameraEuler);
        }

        // Weapon Sway (Balanço da arma ao andar)
        const isMoving = (Math.abs(velocity.x) > 1 || Math.abs(velocity.z) > 1);
        if (isMoving && !isAiming) {
            gunGroup.position.y = -0.22 + Math.sin(time * 0.01) * 0.01;
            gunGroup.position.x = 0.18 + Math.cos(time * 0.005) * 0.01;
        } else {
            gunGroup.position.y = THREE.MathUtils.lerp(gunGroup.position.y, isAiming ? -0.15 : -0.22, 0.1);
            gunGroup.position.x = THREE.MathUtils.lerp(gunGroup.position.x, isAiming ? 0 : 0.18, 0.1);
        }
    }

    camera.fov += ((isAiming ? weaponsConfig[currentWeapon].zoomFov || 50 : 80) - camera.fov) * 15 * delta;
    camera.updateProjectionMatrix();

    updateBotLogic(delta, time);

    prevTime = time;
    renderer.render(scene, camera);
}
