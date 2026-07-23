import { itemsConfig, safeSpawns } from './config.js';
import { playShootSound, playExplosionSound, playReloadSound } from './audio.js';
import { buildMapGeometries, collidables, wallMeshes, mapWallMeshes } from './map.js';
import { updateBotLogic } from './bot.js';

let gameMode = 'bot';
let playerNick = "Striker", selectedMap = "dust2";
let playerMoney = 5000;
let hp = 100, isDead = false;

let scene, camera, renderer, prevTime = performance.now();
let moveF = false, moveB = false, moveL = false, moveR = false, canJump = true;
let isRunning = false, isCrouching = false;
let velocity = new THREE.Vector3(), currentHeight = 1.8;
let gunGroup, muzzleFlashMesh, muzzleLight;
let bots = [];
let networkPlayers = {};
let playerScores = {};
const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');

let inventory = {
    secondary: { key: 'deagle', ammo: 7, reserveAmmo: 35 },
    primary: null
};
let activeSlot = 'secondary';
let isAiming = false, pointerLocked = false, buyMenuOpen = false, isMouseDown = false;
let playerBox = new THREE.Box3();

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
    let barrelOffsetZ = -0.45;
    const curKey = getCurrentWeaponKey();

    if (curKey === 'ak47') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.45), mDark);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.2), mWood); stock.position.set(0, -0.02, 0.3);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3), mDark); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.01, -0.45);
        gunGroup.add(body, stock, barrel);
    } else {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.35), mDark);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2), mDark); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0, -0.27);
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

    gunGroup.position.set(0.18, -0.22, -0.3);
}

function initGameEngine() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.0025);

    camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.8, 0);

    const ambientLight = new THREE.AmbientLight(0xddeeff, 0.65);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.2);
    dirLight.position.set(100, 180, 80);
    dirLight.castShadow = true;
    scene.add(dirLight);

    buildMapGeometries(scene, selectedMap);

    // Cria e adiciona a arma na câmera do jogador
    gunGroup = new THREE.Group();
    camera.add(gunGroup); 
    scene.add(camera);
    build3DWeapon();

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

    document.addEventListener('mousemove', (e) => {
        if (!pointerLocked || isDead || buyMenuOpen) return;
        const sens = isAiming ? 0.0006 : 0.0015;
        cameraEuler.y -= e.movementX * sens;
        cameraEuler.x -= e.movementY * sens;
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

// Quando clica no botão "INICIAR PARTIDA"
btnStart.addEventListener('click', () => {
    document.getElementById('lobby-container').style.display = 'none';
    container.style.display = 'block';
    
    // Força a exibição de todos os elementos da interface (HUD)
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
