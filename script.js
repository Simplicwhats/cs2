let gameMode = 'bot';
let botActive = true;
let peer, conn, isHost = true, networkReady = false;
let playerNick = "Player_1";

const weaponsConfig = {
    ak47: { name: "AK-47", damage: 34, fireRate: 100, maxAmmo: 30, spread: 0.02, zoomFov: 55, recoil: 0.03 },
    m4a4: { name: "M4A4", damage: 24, fireRate: 85, maxAmmo: 30, spread: 0.015, zoomFov: 60, recoil: 0.02 },
    awp: { name: "AWP", damage: 100, fireRate: 1200, maxAmmo: 10, spread: 0.001, zoomFov: 20, recoil: 0.08 }
};
let currentWeapon = 'ak47';
let lastShotTime = 0;
let isAiming = false;

const lobbyLinkInput = document.getElementById('lobby-link');
const btnStart = document.getElementById('btn-start');
const netLinkSection = document.getElementById('net-link-section');
const container = document.getElementById('canvas-container');
const lockWarning = document.getElementById('lock-warning');

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

const spawnPoints = [
    { x: -60, z: 60 }, { x: 60, z: -60 }, { x: -60, z: -60 }, { x: 60, z: 60 }
];

if (roomId) {
    isHost = false; botActive = false; gameMode = 'p2p';
    document.getElementById('mode-p2p').classList.add('active');
    document.getElementById('mode-bot').classList.remove('active');
    netLinkSection.style.display = 'block';
    netLinkSection.innerHTML = "<b style='color:#de9b35;'>Conectando à sala... Aguarde.</b>";
    initP2P(null, roomId);
} else {
    const generatedRoom = Math.random().toString(36).substring(2, 8);
    initP2P(generatedRoom);
    const currentUrl = window.location.href.split('?')[0];
    lobbyLinkInput.value = `${currentUrl}?room=${generatedRoom}`;
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
        if(!networkReady) {
            btnStart.disabled = true;
            netLinkSection.innerHTML = `<label>COPIE E ENVIE O LINK PARA SEU AMIGO:</label><input type="text" id="lobby-link" readonly value="${lobbyLinkInput.value}" onclick="this.select(); document.execCommand('copy'); alert('Link copiado!');">`;
        }
    }
}

function initP2P(hostRoomId, targetRoomId) {
    const configPeer = { host: '0.peerjs.com', port: 443, path: '/', secure: true, debug: 1 };
    if (!targetRoomId) {
        peer = new Peer(hostRoomId, configPeer);
        peer.on('connection', (c) => { conn = c; setupConnection(); });
    } else {
        peer = new Peer(configPeer);
        peer.on('open', () => { conn = peer.connect(targetRoomId); setupConnection(); });
        peer.on('error', () => {
            netLinkSection.innerHTML = "<b style='color:#ff3333;'>Sala cheia ou expirada. Recarregue a página.</b>";
        });
    }
}

function setupConnection() {
    conn.on('open', () => {
        networkReady = true; btnStart.disabled = false;
        netLinkSection.innerHTML = "<b style='color:#00ff88; letter-spacing:1px;'>OPONENTE CONECTADO! COMBATE PRONTO.</b>";
    });
    conn.on('data', handleNetworkData);
}

// --- ENGINE GRÁFICA ---
let scene, camera, renderer, prevTime = performance.now();
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, canJump = true;
let isRunning = false, isCrouching = false;
let currentHeight = 1.8;
let headBobTimer = 0; // Para o efeito de andar
        
const velocity = new THREE.Vector3(), direction = new THREE.Vector3();
let hp = 100, ammo = 30, myScore = 0, enemyScore = 0, isReloading = false, isDead = false;
let gunGroup, enemyMesh, playerHitboxMesh;
        
let collidables = []; 
let targetMeshes = []; 
const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
let lastSentTime = 0;

let botData = { position: new THREE.Vector3(20, 1.2, -20), hp: 100, lastShot: 0, velocity: new THREE.Vector3() };
let playerBox = new THREE.Box3(), botBox = new THREE.Box3();

btnStart.addEventListener('click', () => {
    playerNick = document.getElementById('player-nick').value || "Player";
    document.getElementById('display-my-name').innerText = playerNick.toUpperCase();
    
    if (gameMode === 'p2p' && networkReady) conn.send({ type: 'start_game', nick: playerNick });
    startGame();
    setTimeout(() => { container.requestPointerLock(); }, 100);
});

function handleNetworkData(data) {
    if (data.type === 'start_game') startGame();
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

function startGame() {
    document.getElementById('lobby-container').style.display = 'none';
    container.style.display = 'block';
    document.getElementById('hud').style.display = 'flex';
    document.getElementById('scoreboard').style.display = 'block';
    document.getElementById('crosshair').style.display = 'block';
    
    ammo = weaponsConfig[currentWeapon].maxAmmo;
    document.getElementById('ammo').innerText = `${ammo}/${ammo}`;

    initGameEngine();
    animate();
}

function initGameEngine() {
    scene = new THREE.Scene();
    // Skybox estilo "Mirage/Dust2" limpo
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.005);

    camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(isHost ? -40 : 40, 1.8, 40);
    cameraEuler.setFromQuaternion(camera.quaternion);

    // Iluminação Aprimorada
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffdfb3, 1.5);
    dirLight.position.set(60, 100, 40);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 100;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.left = -100;
    dirLight.shadow.camera.right = 100;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Chão PBR
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e6cca3'; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#d4b78c'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, 256, 256);
    const floorTex = new THREE.CanvasTexture(canvas);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(80, 80);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9, metalness: 0.1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    scene.add(floor);

    // Materiais PBR para as caixas
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.8, metalness: 0.2 });
    createSolidObstacle(0, 5, -120, 240, 10, 4, wallMat);
    createSolidObstacle(0, 5, 120, 240, 10, 4, wallMat);
    createSolidObstacle(-120, 5, 0, 4, 10, 240, wallMat);
    createSolidObstacle(120, 5, 0, 4, 10, 240, wallMat);

    const boxMat1 = new THREE.MeshStandardMaterial({ color: 0x5a695e, roughness: 0.7, metalness: 0.1 }); // Verde militar
    const boxMat2 = new THREE.MeshStandardMaterial({ color: 0x8c4b36, roughness: 0.7, metalness: 0.1 }); // Barro vermelho
    
    for (let x = -80; x <= 80; x += 40) {
        for (let z = -80; z <= 80; z += 40) {
            if (x === 0 && z === 0) {
                createSolidObstacle(0, 4, 0, 20, 8, 20, boxMat2);
                continue;
            }
            createSolidObstacle(x, 3, z, 10, 6, 10, Math.random() > 0.5 ? boxMat1 : boxMat2);
        }
    }

    // Inimigo Capsule (Melhor que Cilindro para Hitbox)
    enemyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.3, 16), new THREE.MeshStandardMaterial({ color: botActive ? 0xcc2222 : 0x2266cc, roughness: 0.4 }));
    enemyMesh.position.copy(botData.position); enemyMesh.castShadow = true;
    scene.add(enemyMesh);
    botBox.setFromObject(enemyMesh);
    targetMeshes.push(enemyMesh);

    playerHitboxMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.0, 16), new THREE.MeshBasicMaterial({ visible: false }));
    scene.add(playerHitboxMesh);
    targetMeshes.push(playerHitboxMesh);

    // Renderização da Arma (Visual PBR)
    gunGroup = new THREE.Group();
    const gunMain = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x1f2326, roughness: 0.3, metalness: 0.8 }));
    gunMain.castShadow = true;
    gunGroup.add(gunMain);
    gunGroup.position.set(0.25, -0.25, -0.5);
    camera.add(gunGroup);
    scene.add(camera);

    container.addEventListener('click', () => { if(!isDead) container.requestPointerLock(); });
    document.addEventListener('pointerlockchange', () => {
        if(isDead) return;
        lockWarning.style.display = document.pointerLockElement === container ? 'none' : 'block';
    });

    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement !== container || isDead) return;
        // Sensibilidade do mouse
        cameraEuler.y -= e.movementX * 0.0015;
        cameraEuler.x -= e.movementY * 0.0015;
        cameraEuler.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, cameraEuler.x));
        camera.quaternion.setFromEuler(cameraEuler);
    });

    document.addEventListener('keydown', (e) => {
        if (document.pointerLockElement !== container || isDead) return;
        if (e.code === 'KeyW') moveForward = true;
        if (e.code === 'KeyS') moveBackward = true;
        if (e.code === 'KeyA') moveLeft = true;
        if (e.code === 'KeyD') moveRight = true;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { isRunning = true; }
        if (e.code === 'ControlLeft' || e.code === 'ControlRight') { isCrouching = true; currentHeight = 1.0; }
        if (e.code === 'Space' && canJump && !isCrouching) { velocity.y = 10.0; canJump = false; }
        if (e.code === 'KeyR') reload();
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') moveForward = false;
        if (e.code === 'KeyS') moveBackward = false;
        if (e.code === 'KeyA') moveLeft = false;
        if (e.code === 'KeyD') moveRight = false;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { isRunning = false; }
        if (e.code === 'ControlLeft' || e.code === 'ControlRight') { isCrouching = false; currentHeight = 1.8; }
    });

    document.addEventListener('mousedown', (e) => {
        if (document.pointerLockElement !== container || isDead) return;
        if (e.button === 0) shoot();
        if (e.button === 2) setAim(true);
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 2) setAim(false); });

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Sombras mais suaves
    renderer.outputEncoding = THREE.sRGBEncoding; // Cores mais reais
    container.appendChild(renderer.domElement);
    
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
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
    const config = weaponsConfig[currentWeapon];
    document.getElementById('crosshair').style.opacity = active && currentWeapon === 'awp' ? '0' : '1';
}

function playWeaponSound(type) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (type === 'shoot') {
        const bufferSize = audioCtx.sampleRate * (currentWeapon === 'awp' ? 0.2 : 0.1);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
        const noise = audioCtx.createBufferSource(); noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.setValueAtTime(currentWeapon === 'awp' ? 600 : 1200, audioCtx.currentTime);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(currentWeapon === 'awp' ? 0.7 : 0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + (currentWeapon === 'awp' ? 0.2 : 0.1));
        noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        noise.start();
    }
}

function spawnBulletTracer(fromPos, toPos) {
    const material = new THREE.MeshBasicMaterial({ color: 0xffddaa, transparent: true, opacity: 0.9 });
    const distance = fromPos.distanceTo(toPos);
    if(distance <= 0.1) return;
    const geometry = new THREE.CylinderGeometry(0.01, 0.01, distance, 4);
    geometry.rotateX(Math.PI / 2);
    const tracer = new THREE.Mesh(geometry, material);
    tracer.position.copy(fromPos).add(toPos).multiplyScalar(0.5);
    tracer.lookAt(toPos);
    scene.add(tracer);

    const startTime = performance.now();
    function fade() {
        const elapsed = (performance.now() - startTime) / 80;
        if (elapsed >= 1) { scene.remove(tracer); } 
        else { tracer.material.opacity = 0.9 * (1 - elapsed); requestAnimationFrame(fade); }
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
    
    // Animação da arma
    gunGroup.position.z += 0.1; setTimeout(() => gunGroup.position.z -= 0.1, 50);
    // Recuo da câmera (Kickback)
    cameraEuler.x += config.recoil;
    camera.quaternion.setFromEuler(cameraEuler);

    const origin = new THREE.Vector3().copy(camera.position).add(new THREE.Vector3(0, -0.1, -0.3).applyQuaternion(camera.quaternion));
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0,0), camera);
    
    // Dispersão (Spread) aumenta se não estiver mirando
    const spreadMultiplier = isAiming ? 0.1 : (isRunning ? 2.5 : 1);
    ray.ray.direction.x += (Math.random() - 0.5) * config.spread * spreadMultiplier;
    ray.ray.direction.y += (Math.random() - 0.5) * config.spread * spreadMultiplier;

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
        showKillFeed(`Você eliminou o Bot!`);
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
    
    // Flash vermelho de dano na tela pode ser feito via CSS overlay (opcional)

    if (hp <= 0) {
        isDead = true;
        showKillFeed(`Eliminado por ${origem}`);
        enemyScore++; updateScoreboardHTML();
        if(!botActive) conn.send({type: 'death'});
        moveForward = moveBackward = moveLeft = moveRight = false;
        setAim(false);
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
    container.requestPointerLock();
}

function reload() {
    if (isReloading || ammo === weaponsConfig[currentWeapon].maxAmmo || isDead) return;
    isReloading = true; document.getElementById('ammo').innerText = "RELO";
    setTimeout(() => {
        ammo = weaponsConfig[currentWeapon].maxAmmo;
        document.getElementById('ammo').innerText = `${ammo}/${ammo}`;
        isReloading = false;
    }, 1200); // Recarregamento mais demorado para realismo
}

function updateBotLogic(delta, time) {
    if (!botActive || hp <= 0 || isDead) return;

    const dist = botData.position.distanceTo(camera.position);
    enemyMesh.lookAt(camera.position.x, enemyMesh.position.y, camera.position.z);

    const moveDir = new THREE.Vector3(camera.position.x - botData.position.x, 0, camera.position.z - botData.position.z).normalize();
    const oldBotPos = new THREE.Vector3().copy(botData.position);
    
    if (dist > 12) botData.position.addScaledVector(moveDir, 6.0 * delta); 
    enemyMesh.position.copy(botData.position);
    botBox.setFromObject(enemyMesh);

    for (let box of collidables) {
        if (box.intersectsBox(botBox)) {
            botData.position.copy(oldBotPos);
            enemyMesh.position.copy(oldBotPos);
            botBox.setFromObject(enemyMesh);
            break;
        }
    }

    if (dist < 60 && time - botData.lastShot > 800) { 
        botData.lastShot = time;
        const botEyePos = new THREE.Vector3().copy(botData.position).add(new THREE.Vector3(0, 0.8, 0));
        const playerTargetPos = new THREE.Vector3().copy(camera.position).add(new THREE.Vector3(0, -0.4, 0));
        
        const visionRaycaster = new THREE.Raycaster(botEyePos, new THREE.Vector3().subVectors(playerTargetPos, botEyePos).normalize());
        const obs = visionRaycaster.intersectObjects(targetMeshes);

        let canSee = true;
        if (obs.length > 0 && obs[0].object !== playerHitboxMesh && obs[0].object !== enemyMesh && obs[0].distance < dist) canSee = false;

        if (canSee) {
            if (Math.random() > (0.4 + dist * 0.02)) {
                takeDamage(12, "Bot");
                spawnBulletTracer(botEyePos, playerTargetPos);
            } else {
                const miss = new THREE.Vector3((Math.random() - 0.5)*3, (Math.random() - 0.5)*2, (Math.random() - 0.5)*3);
                spawnBulletTracer(botEyePos, new THREE.Vector3().copy(playerTargetPos).add(miss));
            }
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

    if (!isDead) {
        // Gravidade e Pulo
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 3.5 * delta; 
        
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

        let speed = isCrouching ? 25.0 : (isRunning && moveForward ? 85.0 : 50.0); 
        if (isAiming) speed *= 0.5; 

        // Suavização do FOV ao Mirar
        const targetFov = isAiming ? weaponsConfig[currentWeapon].zoomFov : 80;
        camera.fov += (targetFov - camera.fov) * 10.0 * delta;
        camera.updateProjectionMatrix();

        // Movimento da Câmera para ADS
        const targetGunPosX = isAiming ? 0 : 0.25;
        const targetGunPosY = isAiming ? -0.12 : -0.25;
        gunGroup.position.x += (targetGunPosX - gunGroup.position.x) * 15 * delta;
        gunGroup.position.y += (targetGunPosY - gunGroup.position.y) * 15 * delta;

        if (moveForward || moveBackward) velocity.addScaledVector(camDir, direction.z * speed * delta);
        if (moveLeft || moveRight) velocity.addScaledVector(camRight, direction.x * speed * delta);

        camera.position.x += velocity.x * delta;
        camera.position.z += velocity.z * delta;

        // Head Bobbing (Balanço da cabeça)
        if (canJump && (Math.abs(velocity.x) > 1 || Math.abs(velocity.z) > 1)) {
            headBobTimer += delta * (isRunning ? 15 : 10);
            camera.position.y = currentHeight + Math.sin(headBobTimer) * (isRunning ? 0.1 : 0.05);
        } else {
            camera.position.y += (currentHeight - camera.position.y) * 10 * delta;
        }

        // Colisões
        playerBox.setFromCenterAndSize(camera.position, new THREE.Vector3(1.2, 2.0, 1.2));
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