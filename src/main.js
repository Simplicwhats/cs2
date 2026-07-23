import { itemsConfig } from './config.js';
import { playShootSound, playExplosionSound, playReloadSound } from './audio.js';
import { buildMapGeometries, collidables, wallMeshes, mapWallMeshes } from './map.js';
import { updateBotLogic } from './bot.js';

let gameMode = 'bot';
let playerMoney = 5000;
let hp = 100, isDead = false;

let scene, camera, renderer, prevTime = performance.now();
let moveF = false, moveB = false, moveL = false, moveR = false, canJump = true;
let velocity = new THREE.Vector3(), currentHeight = 1.8;
let gunGroup;
let bots = [];
let lastShotTime = 0;
const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');

let inventory = {
    secondary: { key: 'deagle', ammo: 7, reserveAmmo: 35 },
    primary: null
};
let activeSlot = 'secondary';
let pointerLocked = false, buyMenuOpen = false;

const btnStart = document.getElementById('btn-start');
const container = document.getElementById('canvas-container');

function getCurrentWeaponKey() {
    return inventory[activeSlot] ? inventory[activeSlot].key : 'deagle';
}

function updateHUD() {
    const curKey = getCurrentWeaponKey();
    const curWeaponData = itemsConfig[curKey];
    
    const hpEl = document.getElementById('hp');
    const moneyEl = document.getElementById('money-display');
    const ammoEl = document.getElementById('ammo');
    const reserveEl = document.getElementById('reserve-ammo');
    const weaponEl = document.getElementById('weapon-display');

    if (hpEl) hpEl.innerText = Math.max(0, Math.round(hp));
    if (moneyEl) moneyEl.innerText = `$${playerMoney}`;
    if (ammoEl) ammoEl.innerText = curWeaponData.maxAmmo ? inventory[activeSlot].ammo : '-';
    if (reserveEl) reserveEl.innerText = curWeaponData.maxAmmo ? `/ ${inventory[activeSlot].reserveAmmo}` : '';
    if (weaponEl) weaponEl.innerText = curWeaponData.name;
}

function build3DWeapon() {
    if (!gunGroup) return;
    while (gunGroup.children.length > 0) gunGroup.remove(gunGroup.children[0]);

    const mDark = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, metalness: 0.7, roughness: 0.4 });
    const mWood = new THREE.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.8 });
    const curKey = getCurrentWeaponKey();

    if (curKey === 'ak47') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.45), mDark);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.2), mWood); stock.position.set(0, -0.02, 0.3);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3), mDark); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.01, -0.45);
        gunGroup.add(body, stock, barrel);
    } else {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.35), mDark);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2), mDark); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0, -0.27);
        gunGroup.add(body, barrel);
    }

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.6 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 });
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.2), sleeveMat);
    arm.rotation.x = Math.PI / 2; arm.position.set(-0.03, -0.05, 0.1);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.03), skinMat);
    hand.position.set(-0.02, -0.01, -0.05);
    gunGroup.add(arm, hand);

    gunGroup.position.set(0.18, -0.22, -0.3);
}

function spawnBots() {
    bots = [];
    for (let i = 0; i < 3; i++) {
        const botGroup = new THREE.Group();
        
        const matBody = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.5 });
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.4), matBody); torso.position.y = 0.9;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), matBody); head.position.y = 1.6;
        
        botGroup.add(torso, head);
        
        // Posições variadas para os bots
        botGroup.position.set((i - 1) * 20, 0, -25 - (i * 10));
        scene.add(botGroup);

        bots.push({
            mesh: botGroup,
            hp: 100,
            pos: botGroup.position,
            lastShot: 0,
            strafeDir: i % 2 === 0 ? 1 : -1
        });
    }
}

function shoot() {
    const now = performance.now();
    const curKey = getCurrentWeaponKey();
    const cfg = itemsConfig[curKey];
    if (now - lastShotTime < cfg.fireRate) return;
    if (inventory[activeSlot].ammo <= 0) return;

    lastShotTime = now;
    inventory[activeSlot].ammo--;
    updateHUD();
    playShootSound();

    // Efeito de Recuo do Braço/Arma
    if (gunGroup) {
        gunGroup.position.z += 0.04;
        setTimeout(() => gunGroup.position.z -= 0.04, 40);
    }

    // Raio do Tiro (Raycaster)
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);

    const botMeshes = bots.map(b => b.mesh);
    const hits = ray.intersectObjects([...wallMeshes, ...botMeshes], true);

    if (hits.length > 0) {
        const hit = hits[0];
        for (let bot of bots) {
            if (hit.object.parent === bot.mesh || hit.object === bot.mesh) {
                bot.hp -= cfg.damage;
                if (bot.hp <= 0) {
                    bot.hp = 100;
                    bot.mesh.position.set((Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60);
                }
                break;
            }
        }
    }
}

function initGameEngine() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.0025);

    camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.8, 0);

    const ambientLight = new THREE.AmbientLight(0xddeeff, 0.7);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.2);
    dirLight.position.set(100, 180, 80);
    dirLight.castShadow = true;
    scene.add(dirLight);

    buildMapGeometries(scene, 'dust2');

    gunGroup = new THREE.Group();
    camera.add(gunGroup); 
    scene.add(camera);
    build3DWeapon();

    spawnBots();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    setupEvents();
}

function setupEvents() {
    document.addEventListener('pointerlockchange', () => {
        pointerLocked = !!document.pointerLockElement;
    });

    document.addEventListener('mousedown', (e) => {
        if (pointerLocked && e.button === 0 && !isDead) {
            shoot();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!pointerLocked || isDead || buyMenuOpen) return;
        cameraEuler.y -= e.movementX * 0.0015;
        cameraEuler.x -= e.movementY * 0.0015;
        cameraEuler.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, cameraEuler.x));
        camera.quaternion.setFromEuler(cameraEuler);
    });

    document.addEventListener('keydown', (e) => {
        if (isDead) return;
        switch(e.code) {
            case 'KeyW': moveF = true; break;
            case 'KeyS': moveB = true; break;
            case 'KeyA': moveL = true; break;
            case 'KeyD': moveR = true; break;
            case 'Space': if(canJump) { velocity.y = 10.5; canJump = false; } break;
            case 'KeyR': 
                inventory[activeSlot].ammo = itemsConfig[getCurrentWeaponKey()].maxAmmo; 
                playReloadSound();
                updateHUD(); 
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch(e.code) {
            case 'KeyW': moveF = false; break;
            case 'KeyS': moveB = false; break;
            case 'KeyA': moveL = false; break;
            case 'KeyD': moveR = false; break;
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now(), delta = Math.min((time - prevTime) / 1000, 0.1);

    if (pointerLocked && !isDead) {
        const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
        const camRight = new THREE.Vector3().crossVectors(camDir, camera.up).normalize();

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 4.5 * delta;

        let speed = 65;
        if (moveF) velocity.addScaledVector(camDir, speed * delta);
        if (moveB) velocity.addScaledVector(camDir, -speed * delta);
        if (moveL) velocity.addScaledVector(camRight, -speed * delta);
        if (moveR) velocity.addScaledVector(camRight, speed * delta);

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

        if (camera.position.y < currentHeight) { camera.position.y = currentHeight; velocity.y = 0; canJump = true; }
    }

    updateBotLogic(gameMode, isDead, bots, camera, delta, time, (dmg) => { hp -= dmg; updateHUD(); });

    prevTime = time;
    renderer.render(scene, camera);
}

btnStart.addEventListener('click', () => {
    document.getElementById('lobby-container').style.display = 'none';
    container.style.display = 'block';

    document.getElementById('hud-bottom-left').style.display = 'flex';
    document.getElementById('hud-bottom-right').style.display = 'flex';
    document.getElementById('scoreboard').style.display = 'flex';
    document.getElementById('buy-hint').style.display = 'block';
    document.getElementById('crosshair').style.display = 'block';

    initGameEngine();
    updateHUD();
    animate();
    document.body.requestPointerLock();
});
