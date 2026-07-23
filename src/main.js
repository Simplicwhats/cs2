import { itemsConfig, safeSpawns } from './config.js';
import { playShootSound, playExplosionSound, playReloadSound } from './audio.js';
import { buildMapGeometries, collidables, wallMeshes, mapWallMeshes } from './map.js';
import { updateBotLogic } from './bot.js';

let gameMode = 'bot';
let playerNick = "Striker", selectedMap = "dust2";
let playerMoney = 5000;

let inventory = {
    secondary: { key: 'deagle', ammo: 7, reserveAmmo: 35 },
    primary: null
};
let activeSlot = 'secondary';
let hasArmor = false, hasHelmet = false, grenadesCount = 0;

let lastShotTime = 0, isAiming = false, pointerLocked = false, buyMenuOpen = false, isMouseDown = false;
let scene, camera, renderer, prevTime = performance.now();
let moveF = false, moveB = false, moveL = false, moveR = false, canJump = true;
let isRunning = false, isCrouching = false;
let velocity = new THREE.Vector3(), currentHeight = 1.8;
let hp = 100, isDead = false;
let gunGroup, muzzleFlashMesh, muzzleLight;

let bots = []; 
let networkPlayers = {}; 
let playerScores = {}; 
const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
let playerBox = new THREE.Box3();
let usedSpawns = [];

const btnStart = document.getElementById('btn-start');
const container = document.getElementById('canvas-container');
const pauseScreen = document.getElementById('pause-screen');
const buyMenu = document.getElementById('buy-menu');

function getSafeSpawn(avoidPos) {
    let bestPoint = safeSpawns[0];
    let found = false;

    for (let pt of safeSpawns) {
        let testVec = new THREE.Vector3(pt.x, 1.8, pt.z);
        let tooCloseToAvoid = avoidPos && avoidPos.distanceTo(testVec) < 20;
        let alreadyUsed = usedSpawns.some(u => u.distanceTo(testVec) < 8);

        if (!tooCloseToAvoid && !alreadyUsed) {
            bestPoint = pt;
            found = true;
            break;
        }
    }

    if (!found) {
        let randomIndex = Math.floor(Math.random() * safeSpawns.length);
        bestPoint = safeSpawns[randomIndex];
    }

    let spawnVec = new THREE.Vector3(bestPoint.x, 1.8, bestPoint.z);
    usedSpawns.push(spawnVec);
    return spawnVec;
}

function getCurrentWeaponKey() {
    return inventory[activeSlot] ? inventory[activeSlot].key : 'deagle';
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
        const myScore = playerScores['player'] || 0;
        const enemyScore = playerScores['bots'] || 0;
        wrapper.innerHTML = `<div class="score-card"><span class="p-name">${playerNick.toUpperCase()}:</span><span class="p-score">${myScore}</span></div>`;
        wrapper.innerHTML += ` &nbsp;|&nbsp; <div class="score-card"><span class="p-name">BOTS:</span><span class="p-score">${enemyScore}</span></div>`;
    }
}

function createNetworkPlayer(id, nick) {
    if (networkPlayers[id]) {
        scene.remove(networkPlayers[id]);
    }
    
    const group = new THREE.Group();
    const matUniform = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.6 });
    const matVest = new THREE.MeshStandardMaterial({ color: 0x1a252f, roughness: 0.4 });
    const matSkin = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.7 });
    const matHelmet = new THREE.MeshStandardMaterial({ color: 0x34495e, metalness: 0.4, roughness: 0.3 });
    const matGun = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });

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
}

function spawnBots(count = 5) {
    bots.forEach(b => {
        if (b.mesh) scene.remove(b.mesh);
    });
    bots = [];

    for (let i = 0; i < count; i++) {
        const botId = 'bot_' + i;
        createNetworkPlayer(botId, "Bot " + (i + 1));
        let bMesh = networkPlayers[botId];
        
        let bSpawn = getSafeSpawn(camera ? camera.position : null);
        bMesh.position.set(bSpawn.x, 0, bSpawn.z);
        
        bots.push({
            id: botId,
            mesh: bMesh,
            hp: 100,
            lastShot: 0,
            strafeDir: (i % 2 === 0 ? 1 : -1),
            pos: bMesh.position
        });
    }
}

function build3DWeapon() {
    if (!gunGroup) return;
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

function initGameEngine() {
    scene = new THREE.Scene();
    usedSpawns = [];
    
    let bgColor = 0x87ceeb;
    if(selectedMap === 'mirage') bgColor = 0x6ca3d8;
    if(selectedMap === 'inferno') bgColor = 0x415366;
    if(selectedMap === 'nuke') bgColor = 0x333d48;
    
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.FogExp2(bgColor, 0.0025);

    camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 1000);
    const startSpawn = getSafeSpawn(null);
    camera.position.copy(startSpawn); 

    const ambientLight = new THREE.AmbientLight(0xddeeff, 0.55); 
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.1);
    dirLight.position.set(100, 180, 80); 
    dirLight.castShadow = true;
    scene.add(dirLight);

    buildMapGeometries(scene, selectedMap);

    if (gameMode === 'bot') {
        spawnBots(5);
    }

    gunGroup = new THREE.Group();
    camera.add(gunGroup); 
    scene.add(camera);
    build3DWeapon();

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    setupEvents();
    setupBuyMenuEvents();
}

function setupBuyMenuEvents() {
    const weapons = ['deagle', 'p90', 'ak47', 'm4a4', 'awp'];
    weapons.forEach(wKey => {
        const btn = document.getElementById(`buy-${wKey}`);
        if (btn) btn.onclick = () => buyWeapon(wKey);
    });

    const buyArmorBtn = document.getElementById('buy-armor');
    if (buyArmorBtn) buyArmorBtn.onclick = () => buyGear('armor');

    const buyHelmetBtn = document.getElementById('buy-helmet');
    if (buyHelmetBtn) buyHelmetBtn.onclick = () => buyGear('helmet');

    const buyGrenadeBtn = document.getElementById('buy-grenade');
    if (buyGrenadeBtn) buyGrenadeBtn.onclick = () => buyGear('grenade');
}

function buyWeapon(key) {
    const item = itemsConfig[key];
    if (!item) return;
    if (playerMoney >= item.price) {
        playerMoney -= item.price;
        inventory[item.slot] = { key: key, ammo: item.maxAmmo, reserveAmmo: item.totalAmmo };
        activeSlot = item.slot;
        build3DWeapon();
        updateHUD();
        document.getElementById('buy-money-display').innerText = `$${playerMoney}`;
        showKillFeed(`Adquirido: ${item.name}`);
    } else {
        showKillFeed("Saldo insuficiente!");
    }
}

function buyGear(type) {
    const item = itemsConfig[type];
    if (!item) return;
    if (playerMoney >= item.price) {
        if (type === 'armor' && !hasArmor) {
            hasArmor = true; playerMoney -= item.price;
        } else if (type === 'helmet' && !hasHelmet) {
            hasHelmet = true; playerMoney -= item.price;
        } else if (type === 'grenade' && grenadesCount < 1) {
            grenadesCount++; playerMoney -= item.price;
        }
        updateHUD();
        document.getElementById('buy-money-display').innerText = `$${playerMoney}`;
    }
}

function setupEvents() {
    window.addEventListener('resize', () => {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

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

        if (e.code === 'KeyW' && !moveF) {
            const now = performance.now();
            if (now - lastShotTime < 280) isRunning = true;
            moveF = true;
        }

        switch(e.code) {
            case 'KeyS': moveB = true; break;
            case 'KeyA': moveL = true; break;
            case 'KeyD': moveR = true; break;
            case 'Digit1':
                if (inventory.primary) { activeSlot = 'primary'; build3DWeapon(); updateHUD(); }
                break;
            case 'Digit2':
                activeSlot = 'secondary'; build3DWeapon(); updateHUD();
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
        if (e.button === 0) { isMouseDown = true; shoot(); }
        if (e.button === 2) setAim(true);
    });
    
    document.addEventListener('mouseup', (e) => { 
        if (e.button === 0) isMouseDown = false;
        if (e.button === 2) setAim(false); 
    });
}

function shoot() {
    if(isDead || buyMenuOpen || inventory[activeSlot].ammo <= 0) return;
    const now = performance.now(), curKey = getCurrentWeaponKey(), cfg = itemsConfig[curKey];
    if (now - lastShotTime < cfg.fireRate) return;

    lastShotTime = now; inventory[activeSlot].ammo--; updateHUD();
    playShootSound();

    gunGroup.position.z += 0.05; setTimeout(() => gunGroup.position.z -= 0.05, 50);
    muzzleFlashMesh.material.opacity = 0.8; muzzleLight.intensity = 2.0;
    setTimeout(() => { muzzleFlashMesh.material.opacity = 0; muzzleLight.intensity = 0; }, 40);

    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0,0), camera);
    const hits = ray.intersectObjects(wallMeshes, true);

    if (hits.length > 0) {
        const hit = hits[0];
        if (gameMode === 'bot') {
            for (let bot of bots) {
                if (hit.object.parent === bot.mesh || hit.object === bot.mesh) {
                    bot.hp -= cfg.damage;
                    if (bot.hp <= 0) {
                        playerScores['player'] = (playerScores['player'] || 0) + 1;
                        hp = Math.min(100, hp + 30);
                        playerMoney += 300; 
                        updateHUD(); 
                        updateScoreboard();
                        showKillFeed("+ $300 | +30 HP (Eliminação)");
                        
                        bot.hp = 100;
                        let newPos = getSafeSpawn(camera.position);
                        bot.pos.set(newPos.x, 0.9, newPos.z); 
                        bot.mesh.position.copy(bot.pos);
                    }
                    break;
                }
            }
        }
    }
}

function takeDamage(dmg) {
    if (isDead) return;

    let finalDmg = dmg;
    if (hasHelmet) finalDmg *= 0.5;
    else if (hasArmor) finalDmg *= 0.7;

    hp -= finalDmg;
    updateHUD();

    if (hp <= 0) {
        hp = 0; isDead = true; isMouseDown = false;
        if (gameMode === 'bot') {
            playerScores['bots'] = (playerScores['bots'] || 0) + 1;
            updateScoreboard();
        }
        document.getElementById('round-message').innerText = "VOCÊ FOI ELIMINADO";
        document.getElementById('round-message').style.display = 'block';
        document.exitPointerLock();
        setTimeout(restartRound, 2500);
    }
}

function restartRound() {
    hp = 100; isDead = false;
    playerMoney = 5000; 
    
    inventory = {
        secondary: { key: 'deagle', ammo: 7, reserveAmmo: 35 },
        primary: null
    };
    activeSlot = 'secondary';
    hasArmor = false; hasHelmet = false; grenadesCount = 0;
    
    document.getElementById('round-message').style.display = 'none';
    updateHUD();
    build3DWeapon();
    
    if (camera) camera.position.copy(getSafeSpawn(null)); 
    if (gameMode === 'bot') spawnBots(5);

    pauseScreen.style.display = 'flex';
    pauseScreen.querySelector('h1').innerText = "RODADA REINICIADA";
    pauseScreen.querySelector('p').innerText = "Clique na tela para entrar em combate";
}

function reload() {
    const curInv = inventory[activeSlot];
    const cfg = itemsConfig[getCurrentWeaponKey()];
    if (curInv.ammo === cfg.maxAmmo) return;
    playReloadSound();
    document.getElementById('ammo').innerText = "--";
    setTimeout(() => {
        curInv.ammo = cfg.maxAmmo;
        updateHUD();
    }, 1500);
}

function setAim(active) {
    if(isDead || buyMenuOpen) return;
    isAiming = active;
    const cfg = itemsConfig[getCurrentWeaponKey()];
    if (cfg && cfg.zoomFov) {
        camera.fov = active ? cfg.zoomFov : 80;
        camera.updateProjectionMatrix();
    }
}

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

function showKillFeed(txt) {
    const feed = document.getElementById('kill-feed');
    feed.innerText = txt; feed.style.display = 'block';
    setTimeout(() => feed.style.display='none', 2000);
}

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now(), delta = Math.min((time - prevTime) / 1000, 0.1);

    if (pointerLocked && !isDead && !buyMenuOpen) {
        if (isMouseDown && itemsConfig[getCurrentWeaponKey()].auto) shoot();

        const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
        const camRight = new THREE.Vector3().crossVectors(camDir, camera.up).normalize();

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 4.5 * delta;

        let speed = isCrouching ? 25 : (isRunning ? 110 : 65);
        if (moveF) velocity.addScaledVector(camDir, speed * delta);
        if (moveB) velocity.addScaledVector(camDir, -speed * delta);
        if (moveL) velocity.addScaledVector(camRight, -speed * delta);
        if (moveR) velocity.addScaledVector(camRight, speed * delta);

        const oldPos = camera.position.clone();
        camera.position.x += velocity.x * delta;
        camera.position.z += velocity.z * delta;

        const feetRay = new THREE.Raycaster(camera.position, new THREE.Vector3(0, -1, 0), 0, currentHeight + 1.2);
        const feetHits = feetRay.intersectObjects(mapWallMeshes, true);

        if (feetHits.length > 0) {
            let hitGroundY = feetHits[0].point.y + currentHeight;
            let diffY = hitGroundY - camera.position.y;
            if (diffY > -1.2 && diffY < 2.0) {
                camera.position.y = hitGroundY;
                velocity.y = 0;
                canJump = true;
            }
        } else {
            camera.position.y += velocity.y * delta;
        }

        playerBox.setFromCenterAndSize(camera.position, new THREE.Vector3(0.6, 1.8, 0.6));
        for (let box of collidables) {
            if (box.userData && box.userData.mesh && box.userData.mesh.userData && box.userData.mesh.userData.isRamp) continue;
            if (playerBox.intersectsBox(box)) {
                camera.position.x = oldPos.x;
                camera.position.z = oldPos.z;
                break;
            }
        }

        if (camera.position.y < currentHeight) { camera.position.y = currentHeight; velocity.y = 0; canJump = true; }
    }

    updateBotLogic(gameMode, isDead, bots, camera, delta, time, takeDamage);

    prevTime = time;
    if (renderer && scene && camera) renderer.render(scene, camera);
}

// Inicialização do Lobby
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (btn.id === 'mode-bot') {
            gameMode = 'bot';
            document.getElementById('net-link-section').style.display = 'none';
        } else {
            gameMode = 'online';
            document.getElementById('net-link-section').style.display = 'block';
        }
    };
});

btnStart.addEventListener('click', () => {
    playerNick = document.getElementById('player-nick').value || "Striker";
    selectedMap = document.getElementById('map-select').value;
    
    document.getElementById('lobby-container').style.display = 'none';
    container.style.display = 'block';
    document.getElementById('scoreboard').style.display = 'flex';
    document.getElementById('hud-bottom-left').style.display = 'flex';
    document.getElementById('hud-bottom-right').style.display = 'flex';
    document.getElementById('buy-hint').style.display = 'block';
    document.getElementById('crosshair').style.display = 'block';
    
    initGameEngine();
    updateHUD();
    updateScoreboard();
    animate();
    document.body.requestPointerLock();
});

document.getElementById('btn-resume').addEventListener('click', () => document.body.requestPointerLock());
document.getElementById('btn-close-buy').addEventListener('click', () => toggleBuyMenu(false));

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
