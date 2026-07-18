let gameMode = 'bot';
let botActive = true;
let peer, conn, isHost = true, networkReady = false;
let playerNick = "Player_1";

// Status e configurações de armas
const weaponsConfig = {
    ak47: { name: "AK-47", damage: 34, fireRate: 100, maxAmmo: 30, spread: 0.02, zoomFov: 65, recoil: 0.02 },
    m4a4: { name: "M4A4", damage: 24, fireRate: 85, maxAmmo: 30, spread: 0.015, zoomFov: 70, recoil: 0.015 },
    awp: { name: "AWP", damage: 100, fireRate: 1200, maxAmmo: 10, spread: 0.001, zoomFov: 20, recoil: 0.08 }
};
let currentWeapon = 'ak47';
let lastShotTime = 0;
let isAiming = false;
let pointerLocked = false;

// Elementos da UI
const lobbyLinkInput = document.getElementById('lobby-link');
const btnStart = document.getElementById('btn-start');
const netLinkSection = document.getElementById('net-link-section');
const container = document.getElementById('canvas-container');
const pauseScreen = document.getElementById('pause-screen');
const btnResume = document.getElementById('btn-resume');

// Inicialização de rede (Lobby)
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const spawnPoints = [{ x: -60, z: 60 }, { x: 60, z: -60 }, { x: -60, z: -60 }, { x: 60, z: 60 }];

if (roomId) {
    isHost = false; botActive = false; gameMode = 'p2p';
    document.getElementById('mode-p2p').classList.add('active');
    document.getElementById('mode-bot').classList.remove('active');
    netLinkSection.style.display = 'block';
    netLinkSection.innerHTML = "<b style='color:#de9b35;'>Conectando à sala...</b>";
    initP2P(null, roomId);
} else {
    const generatedRoom = Math.random().toString(36).substring(2, 8);
    initP2P(generatedRoom);
    lobbyLinkInput.value = `${window.location.href.split('?')[0]}?room=${generatedRoom}`;
}

function selectWeapon(weapKey, event) {
    currentWeapon = weapKey;
    document.querySelectorAll('.weap-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.getElementById('weapon-display').innerText = weaponsConfig[weapKey].name;
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
        netLinkSection.innerHTML = "<b style='color:#00ff88;'>OPONENTE CONECTADO!</b>";
    });
    conn.on('data', handleNetworkData);
}

// --- ENGINE GRÁFICA ---
let scene, camera, renderer, prevTime = performance.now();
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, canJump = true;
let isRunning = false, isCrouching = false;
let currentHeight = 1.8;
let headBobTimer = 0;
        
const velocity = new THREE.Vector3(), direction = new THREE.Vector3();
let hp = 100, ammo = 30, myScore = 0, enemyScore = 0, isReloading = false, isDead = false;
let gunGroup, enemyMesh, playerHitboxMesh;
        
let collidables = []; 
let targetMeshes = []; 
const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
let lastSentTime = 0;

// IA Tática do Bot
let botData = { 
    position: new THREE.Vector3(20, 1.2, -20), 
    hp: 100, 
    lastShot: 0, 
    state: 'patrol',
    targetPos: new THREE.Vector3(),
    stuckTimer: 0
};
let playerBox = new THREE.Box3(), botBox = new THREE.Box3();

// INÍCIO DO JOGO
btnStart.addEventListener('click', () => {
    playerNick = document.getElementById('player-nick').value || "Player";
    document.getElementById('display-my-name').innerText = playerNick.toUpperCase();
    
    if (gameMode === 'p2p' && networkReady) conn.send({ type: 'start_game', nick: playerNick });
    
    document.getElementById('lobby-container').style.display = 'none';
    container.style.display = 'block';
    document.getElementById('hud').style.display = 'flex';
    document.getElementById('scoreboard').style.display = 'block';
    
    document.getElementById('crosshair').innerHTML = `
        <div class="ch-line ch-top"></div><div class="ch-line ch-bottom"></div>
        <div class="ch-line ch-left"></div><div class="ch-line ch-right"></div>
    `;
    document.getElementById('crosshair').style.display = 'block';
    
    ammo = weaponsConfig[currentWeapon].maxAmmo;
    document.getElementById('ammo').innerText = `${ammo}/${ammo}`;

    initGameEngine();
    animate();
    showPauseScreen();
});

// FIX INFALÍVEL DO POINTER LOCK NO BODY DA PÁGINA
btnResume.addEventListener('click', () => {
    document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) {
        pointerLocked = true;
        pauseScreen.style.display = 'none';
    } else {
        pointerLocked = false;
        showPauseScreen();
        moveForward = moveBackward = moveLeft = moveRight = false; 
    }
});

document.addEventListener('pointerlockerror', () => {
    console.error("O navegador bloqueou a captura do mouse. Clique na tela novamente.");
});

function showPauseScreen() {
    if(!isDead) {
        pauseScreen.style.display = 'flex';
        moveForward = moveBackward = moveLeft = moveRight = false;
    }
}

function handleNetworkData(data) {
    if (botActive) return;
    if (data.type === 'pos_update' && enemyMesh) {
        enemyMesh.position.set(data.x, data.y, data.z);
        enemyMesh.rotation.y = data.ry;
        botBox.setFromObject(enemyMesh);
    }
    if (data.type === 'hit') takeDamage(data.damage, "Inimigo");
    if (data.type === 'score_sync') { enemyScore = data.score; updateScoreboardHTML(); }
    if (data.type === 'death') { showKillFeed("Você eliminou o inimigo!"); myScore++; updateScoreboardHTML(); }
}

function updateScoreboardHTML() {
    document.getElementById('score-player').innerText = myScore;
    document.getElementById('score-enemy').innerText = enemyScore;
}

// GERADORES DE TEXTURA PROCEDURAL
function createSandTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < 512; i+=4) {
        for (let j = 0; j < 512; j+=4) {
            let val = Math.floor(200 + Math.random() * 30);
            ctx.fillStyle = `rgb(${val}, ${val - 20}, ${val - 60})`;
            ctx.fillRect(i, j, 4, 4);
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(60, 60);
    return tex;
}

function createWallTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#bfa98e'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#8f7b64';
    for(let y=0; y<256; y+=32) {
        ctx.fillRect(0, y, 256, 2);
        for(let x=0; x<256; x+=64) {
            let offsetX = (y % 64 === 0) ? 32 : 0;
            ctx.fillRect(x + offsetX, y, 2, 32);
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(5, 5);
    return tex;
}

function initGameEngine() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa5cbe8);
    scene.fog = new THREE.FogExp2(0xa5cbe8, 0.003);

    camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(isHost ? -40 : 40, 1.8, 40);
    cameraEuler.setFromQuaternion(camera.quaternion);

    const ambientLight = new THREE.AmbientLight(0xffeedd, 0.5);
    scene.add(ambientLight);
    
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 100, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    dirLight.position.set(80, 150, 50);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 150;
    dirLight.shadow.camera.bottom = -150;
    dirLight.shadow.camera.left = -150;
    dirLight.shadow.camera.right = 150;
    dirLight.shadow.mapSize.width = 2048; 
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const floorMat = new THREE.MeshStandardMaterial({ map: createSandTexture(), roughness: 1.0, metalness: 0.0 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ map: createWallTexture(), roughness: 0.9 });
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x5a695e, roughness: 0.6 });
    
    createSolidObstacle(0, 5, -120, 240, 10, 2, wallMat);
    createSolidObstacle(0, 5, 120, 240, 10, 2, wallMat);
    createSolidObstacle(-120, 5, 0, 2, 10, 240, wallMat);
    createSolidObstacle(120, 5, 0, 2, 10, 240, wallMat);

    for (let x = -80; x <= 80; x += 40) {
        for (let z = -80; z <= 80; z += 40) {
            if (x === 0 && z === 0) {
                createSolidObstacle(0, 4, 0, 20, 8, 20, wallMat);
                continue;
            }
            createSolidObstacle(x, 3, z, 10, 6, 10, boxMat);
        }
    }

    enemyMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 2.3, 16), 
        new THREE.MeshStandardMaterial({ color: botActive ? 0xcc3333 : 0x3366cc, roughness: 0.3, metalness: 0.2 })
    );
    enemyMesh.position.copy(botData.position); enemyMesh.castShadow = true;
    scene.add(enemyMesh);
    botBox.setFromObject(enemyMesh);
    targetMeshes.push(enemyMesh);

    playerHitboxMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.0, 16), new THREE.MeshBasicMaterial({ visible: false }));
    scene.add(playerHitboxMesh);
    targetMeshes.push(playerHitboxMesh);

    gunGroup = new THREE.Group();
    const gunMain = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.6), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2, metalness: 0.8 }));
    gunMain.castShadow = true;
    gunGroup.add(gunMain);
    gunGroup.position.set(0.25, -0.25, -0.5);
    camera.add(gunGroup);
    scene.add(camera);

    // CONTROLES DE MIRA CORRIGIDOS
    document.addEventListener('mousemove', (e) => {
        if (!pointerLocked || isDead) return;
        
        const sensitivity = isAiming ? 0.0006 : 0.0018;
        
        cameraEuler.y -= e.movementX * sensitivity;
        cameraEuler.x -= e.movementY * sensitivity;
        
        cameraEuler.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, cameraEuler.x));
        camera.quaternion.setFromEuler(cameraEuler);
    });

    document.addEventListener('keydown', (e) => {
        if (!pointerLocked || isDead) return;
        if (e.code === 'KeyW') moveForward = true;
        if (e.code === 'KeyS') moveBackward = true;
        if (e.code === 'KeyA') moveLeft = true;
        if (e.code === 'KeyD') moveRight = true;
        if (e.code === 'ShiftLeft') isRunning = true;
        if (e.code === 'ControlLeft') { isCrouching = true; currentHeight = 1.0; }
        if (e.code === 'Space' && canJump && !isCrouching) { velocity.y = 11.0; canJump = false; }
        if (e.code === 'KeyR') reload();
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') moveForward = false;
        if (e.code === 'KeyS') moveBackward = false;
        if (e.code === 'KeyA') moveLeft = false;
        if (e.code === 'KeyD') moveRight = false;
        if (e.code === 'ShiftLeft') isRunning = false;
        if (e.code === 'ControlLeft') { isCrouching = false; currentHeight = 1.8; }
    });

    // CLIQUE FORÇA O TRAVAMENTO DO MOUSE E ATIRA
    document.addEventListener('mousedown', (e) => {
        if (!document.pointerLockElement) {
            document.body.requestPointerLock();
            return; 
        }
        
        if (isDead) return;
        if (e.button === 0) shoot();
        if (e.button === 2) setAim(true);
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 2) setAim(false); });

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    renderer.outputEncoding = THREE.sRGBEncoding; 
    container.appendChild(renderer.domElement);
    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function createSolidObstacle(x, y, z, w, h, d, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    const box = new THREE.Box3().setFromObject(mesh);
    collidables.push(box);
    targetMeshes.push(mesh);
    return mesh;
}

function setAim(active) {
    if(isDead) return;
    isAiming = active;
    document.getElementById('crosshair').style.opacity = active && currentWeapon === 'awp' ? '0' : '1';
}

function playWeaponSound(type) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (type === 'shoot') {
        const bufferSize = audioCtx.sampleRate * 0.15;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource(); noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.setValueAtTime(currentWeapon === 'awp' ? 500 : 1000, audioCtx.currentTime);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(currentWeapon === 'awp' ? 0.8 : 0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        noise.start();
    }
}

function spawnBulletTracer(fromPos, toPos) {
    const material = new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 1 });
    const distance = fromPos.distanceTo(toPos);
    if(distance <= 0.1) return;
    const geometry = new THREE.CylinderGeometry(0.015, 0.015, distance, 4);
    geometry.rotateX(Math.PI / 2);
    const tracer = new THREE.Mesh(geometry, material);
    tracer.position.copy(fromPos).add(toPos).multiplyScalar(0.5);
    tracer.lookAt(toPos);
    scene.add(tracer);

    const startTime = performance.now();
    function fade() {
        const elapsed = (performance.now() - startTime) / 60;
        if (elapsed >= 1) { scene.remove(tracer); } 
        else { tracer.material.opacity = 1 - elapsed; requestAnimationFrame(fade); }
    }
    fade();
}

function shoot() {
    if(isDead) return;
    const now = performance.now();
    const config = weaponsConfig[currentWeapon];
    if (now - lastShotTime < config.fireRate || ammo <= 0 || isReloading) return;
    
    lastShotTime = now; ammo--;
    document.getElementById('ammo').innerText = `${ammo}/${config.maxAmmo}`;
    playWeaponSound('shoot');
    
    gunGroup.position.z += 0.12; setTimeout(() => gunGroup.position.z -= 0.12, 50);
    cameraEuler.x += config.recoil; 
    cameraEuler.y += (Math.random() - 0.5) * config.recoil * 0.5; 
    camera.quaternion.setFromEuler(cameraEuler);

    const origin = new THREE.Vector3().copy(camera.position).add(new THREE.Vector3(0, -0.1, -0.3).applyQuaternion(camera.quaternion));
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0,0), camera);
    
    let spread = config.spread;
    if (!isAiming) spread *= 2;
    if (Math.abs(velocity.x) > 1 || Math.abs(velocity.z) > 1) spread *= 4; 
    if (canJump === false) spread *= 6; 

    ray.ray.direction.x += (Math.random() - 0.5) * spread;
    ray.ray.direction.y += (Math.random() - 0.5) * spread;

    const intersections = ray.intersectObjects(targetMeshes);
    let hitEndPoint = new THREE.Vector3().copy(ray.ray.origin).addScaledVector(ray.ray.direction, 200);

    if (intersections.length > 0) {
        const hit = intersections[0];
        hitEndPoint.copy(hit.point);
        if (hit.object === enemyMesh) {
            if (botActive) botTakeDamage(config.damage);
            else conn.send({ type: 'hit', damage: config.damage });
        }
    }
    spawnBulletTracer(origin, hitEndPoint);
    if (ammo === 0) reload();
}

function botTakeDamage(dmg) {
    botData.hp -= dmg;
    if (botData.hp <= 0) {
        showKillFeed(`Inimigo Eliminado!`);
        myScore++; updateScoreboardHTML();
        botData.hp = 100;
        const randomSpawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
        botData.position.set(randomSpawn.x, 1.2, randomSpawn.z);
        enemyMesh.position.copy(botData.position);
    }
}

function takeDamage(dmg, origem) {
    if (isDead) return;
    hp -= dmg; if (hp < 0) hp = 0;
    document.getElementById('hp').innerText = hp;

    if (hp <= 0) {
        isDead = true;
        showKillFeed(`Eliminado`);
        enemyScore++; updateScoreboardHTML();
        if(!botActive) conn.send({type: 'death'});
        
        document.exitPointerLock();
        setTimeout(respawnPlayer, 3000);
    }
}

function respawnPlayer() {
    hp = 100; isDead = false;
    document.getElementById('hp').innerText = hp;
    ammo = weaponsConfig[currentWeapon].maxAmmo;
    document.getElementById('ammo').innerText = `${ammo}/${ammo}`;

    const randomSpawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    camera.position.set(randomSpawn.x, 1.8, randomSpawn.z);
    velocity.set(0,0,0);
    cameraEuler.set(0,0,0, 'YXZ');
    camera.quaternion.setFromEuler(cameraEuler);
    
    showPauseScreen(); 
}

function reload() {
    if (isReloading || ammo === weaponsConfig[currentWeapon].maxAmmo || isDead) return;
    isReloading = true; document.getElementById('ammo').innerText = "RELO";
    setTimeout(() => {
        ammo = weaponsConfig[currentWeapon].maxAmmo;
        document.getElementById('ammo').innerText = `${ammo}/${ammo}`;
        isReloading = false;
    }, 1500); 
}

function updateBotLogic(delta, time) {
    if (!botActive || hp <= 0 || isDead) return;

    const dist = botData.position.distanceTo(camera.position);
    enemyMesh.lookAt(camera.position.x, enemyMesh.position.y, camera.position.z);
    
    const botEyePos = new THREE.Vector3().copy(botData.position).add(new THREE.Vector3(0, 0.8, 0));
    const playerTargetPos = new THREE.Vector3().copy(camera.position).add(new THREE.Vector3(0, -0.4, 0));
    
    const visionRaycaster = new THREE.Raycaster(botEyePos, new THREE.Vector3().subVectors(playerTargetPos, botEyePos).normalize());
    const obs = visionRaycaster.intersectObjects(targetMeshes);
    let canSeePlayer = false;
    if (obs.length > 0 && (obs[0].object === playerHitboxMesh || obs[0].distance >= dist)) {
        canSeePlayer = true;
    }

    if (canSeePlayer) {
        botData.state = 'attack';
    } else {
        botData.state = 'patrol';
    }

    const oldBotPos = new THREE.Vector3().copy(botData.position);
    let botSpeed = 10.0;

    if (botData.state === 'patrol') {
        const moveDir = new THREE.Vector3(camera.position.x - botData.position.x, 0, camera.position.z - botData.position.z).normalize();
        botData.position.addScaledVector(moveDir, botSpeed * delta);
    } else if (botData.state === 'attack') {
        if (time - botData.lastShot > 600) {
            botData.lastShot = time;
            if (Math.random() > (0.3 + dist * 0.015)) {
                takeDamage(15, "Bot IA");
                spawnBulletTracer(botEyePos, playerTargetPos);
            } else {
                const miss = new THREE.Vector3((Math.random() - 0.5)*2, (Math.random() - 0.5)*1.5, (Math.random() - 0.5)*2);
                spawnBulletTracer(botEyePos, new THREE.Vector3().copy(playerTargetPos).add(miss));
            }
        } else {
            const strafeDir = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), new THREE.Vector3(camera.position.x - botData.position.x, 0, camera.position.z - botData.position.z).normalize());
            if (Math.sin(time / 500) > 0) strafeDir.negate(); 
            botData.position.addScaledVector(strafeDir, botSpeed * 0.6 * delta);
        }
    }

    enemyMesh.position.copy(botData.position);
    botBox.setFromObject(enemyMesh);
    for (let box of collidables) {
        if (box.intersectsBox(botBox)) {
            botData.position.copy(oldBotPos);
            enemyMesh.position.copy(oldBotPos);
            botBox.setFromObject(enemyMesh);
            
            botData.position.x += (Math.random() - 0.5) * 0.5;
            botData.position.z += (Math.random() - 0.5) * 0.5;
            break;
        }
    }
}

function showKillFeed(text) {
    const feed = document.getElementById('kill-feed');
    feed.innerText = text; feed.style.display = 'block';
    setTimeout(() => feed.style.display = 'none', 3000);
}

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = Math.min((time - prevTime) / 1000, 0.1);
    const oldPlayerPos = new THREE.Vector3().copy(camera.position);

    if (!isDead && pointerLocked) {
        velocity.x -= velocity.x * 12.0 * delta; 
        velocity.z -= velocity.z * 12.0 * delta;
        velocity.y -= 9.8 * 4.0 * delta; 
        
        camera.position.y += velocity.y * delta;

        if (camera.position.y <= currentHeight) {
            camera.position.y = currentHeight;
            velocity.y = 0; canJump = true;
        }

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
        const camRight = new THREE.Vector3().crossVectors(camera.up, camDir).negate().normalize();

        let speed = isCrouching ? 35.0 : (isRunning && moveForward ? 110.0 : 75.0); 
        if (isAiming) speed *= 0.5; 

        // Suavização do FOV
        const targetFov = isAiming ? weaponsConfig[currentWeapon].zoomFov : 80;
        camera.fov += (targetFov - camera.fov) * 15.0 * delta;
        camera.updateProjectionMatrix();

        // Movimento da arma ADS CORRIGIDO
        const targetGunX = isAiming ? 0 : 0.25;
        const targetGunY = isAiming ? -0.14 : -0.25;
        gunGroup.position.x += (targetGunX - gunGroup.position.x) * 20 * delta;
        gunGroup.position.y += (targetGunY - gunGroup.position.y) * 20 * delta;

        if (moveForward || moveBackward) velocity.addScaledVector(camDir, direction.z * speed * delta);
        if (moveLeft || moveRight) velocity.addScaledVector(camRight, direction.x * speed * delta);

        camera.position.x += velocity.x * delta;
        camera.position.z += velocity.z * delta;

        // Animação de Caminhada CORRIGIDA
        if (canJump && (Math.abs(velocity.x) > 1 || Math.abs(velocity.z) > 1)) {
            headBobTimer += delta * (isRunning ? 18 : 12);
            camera.position.y = currentHeight + Math.sin(headBobTimer) * 0.08;
        } else {
            camera.position.y += (currentHeight - camera.position.y) * 10 * delta;
        }

        playerBox.setFromCenterAndSize(camera.position, new THREE.Vector3(1.0, 2.0, 1.0));
        for (let box of collidables) {
            if (playerBox.intersectsBox(box)) {
                camera.position.x = oldPlayerPos.x;
                camera.position.z = oldPlayerPos.z;
                velocity.x = velocity.z = 0;
                break;
            }
        }
    }
    
    if (playerHitboxMesh) playerHitboxMesh.position.copy(camera.position);

    updateBotLogic(delta, time);

    if (networkReady && !botActive && time - lastSentTime > 35) {
        conn.send({ type: 'pos_update', x: camera.position.x, y: camera.position.y, z: camera.position.z, ry: cameraEuler.y });
        lastSentTime = time;
    }

    prevTime = time;
    renderer.render(scene, camera);
}
