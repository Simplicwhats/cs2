// src/main.js
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { weapons, mapConfig } from './config.js';
import { createMap, collidableObjects } from './map.js';
import { playShootSound } from './audio.js';

// Variáveis Principais
let camera, scene, renderer, controls;
let currentWeaponId = 'deagle';
let weaponMesh = null;
let isAiming = false;
let isReloading = false;

// Variáveis de Física e Movimento
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let canJump = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();
const raycaster = new THREE.Raycaster();

// Elementos da UI
const uiAmmo = document.getElementById('ammo');
const uiReserve = document.getElementById('reserve-ammo');
const btnStart = document.getElementById('btn-start');
const lobby = document.getElementById('lobby-container');

init();
animate();

function init() {
    // Configuração de Cena e Câmera
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Céu azul claro
    scene.fog = new THREE.Fog(0x87ceeb, 0, 50);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(mapConfig.spawnPoint.x, mapConfig.spawnPoint.y, mapConfig.spawnPoint.z);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('canvas-container').appendChild(renderer.domElement);
    document.getElementById('canvas-container').style.display = 'block';

    // Controles (PointerLock)
    controls = new PointerLockControls(camera, document.body);
    btnStart.addEventListener('click', () => {
        controls.lock();
        lobby.style.display = 'none';
    });

    scene.add(controls.getObject());

    // Eventos de Teclado e Mouse
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);

    // Carrega Mapa e Arma Inicial
    createMap(scene);
    loadWeapon(currentWeaponId);

    window.addEventListener('resize', onWindowResize);
}

function loadWeapon(weaponId) {
    if (weaponMesh) camera.remove(weaponMesh); // Remove a arma anterior
    
    const config = weapons[weaponId];
    const loader = new GLTFLoader();
    
    // Se você não tiver os arquivos .glb, ele criará um bloco provisório para não travar
    try {
        loader.load(config.modelPath, (gltf) => {
            weaponMesh = gltf.scene;
            setupWeaponMesh(config);
        }, undefined, (error) => {
            console.warn("Modelo não encontrado, criando arma genérica...");
            createPlaceholderWeapon(config);
        });
    } catch(e) {
        createPlaceholderWeapon(config);
    }
}

function setupWeaponMesh(config) {
    weaponMesh.scale.set(config.scale, config.scale, config.scale); // Aplica a escala corrigida
    weaponMesh.position.set(...config.posicaoNormal);
    camera.add(weaponMesh);
    
    // Atualiza HUD
    uiAmmo.innerText = config.municaoMax;
    uiReserve.innerText = `/ ${config.reservaMax}`;
}

function createPlaceholderWeapon(config) {
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.5);
    const mat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    weaponMesh = new THREE.Mesh(geo, mat);
    setupWeaponMesh(config);
}

// Lógica de Controles
function onKeyDown(event) {
    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyD': moveRight = true; break;
        case 'Space': 
            if (canJump) velocity.y += mapConfig.jumpForce; 
            canJump = false; 
            break;
        case 'KeyR': reloadWeapon(); break;
        case 'Digit1': loadWeapon('ak47'); currentWeaponId = 'ak47'; break;
        case 'Digit2': loadWeapon('deagle'); currentWeaponId = 'deagle'; break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyD': moveRight = false; break;
    }
}

function onMouseDown(event) {
    if (!controls.isLocked) return;

    if (event.button === 0 && !isReloading) { // Botão Esquerdo (Tiro)
        playShootSound();
        // Lógica de diminuir munição entraria aqui
    } else if (event.button === 2 && weaponMesh) { // Botão Direito (Mira/ADS)
        isAiming = true;
        const config = weapons[currentWeaponId];
        camera.fov = config.fovMira;
        camera.updateProjectionMatrix();
        weaponMesh.position.set(...config.posicaoMira); // Centraliza a arma
        
        // Efeito visual AWP
        if(currentWeaponId === 'awp') {
            document.getElementById('scope-overlay').style.display = 'block';
            weaponMesh.visible = false;
        }
    }
}

function onMouseUp(event) {
    if (event.button === 2 && weaponMesh) { // Solta a mira
        isAiming = false;
        const config = weapons[currentWeaponId];
        camera.fov = 75; // FOV Padrão
        camera.updateProjectionMatrix();
        weaponMesh.position.set(...config.posicaoNormal); // Arma volta pro canto
        
        document.getElementById('scope-overlay').style.display = 'none';
        weaponMesh.visible = true;
    }
}

function reloadWeapon() {
    if (isReloading) return;
    isReloading = true;
    const config = weapons[currentWeaponId];

    // Animação simples de recarga (gira a arma para baixo)
    if(weaponMesh) weaponMesh.rotation.x = -Math.PI / 4;
    uiAmmo.innerText = "Recarregando...";

    setTimeout(() => {
        if(weaponMesh) weaponMesh.rotation.x = 0; // Volta a arma
        uiAmmo.innerText = config.municaoMax; // Reseta munição
        isReloading = false;
    }, config.tempoRecarga);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Loop Principal e Física
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    if (controls.isLocked === true) {
        const delta = (time - prevTime) / 1000;

        // FÍSICA: Raycaster para checar o chão (corrige o bug de voar)
        raycaster.ray.origin.copy(controls.getObject().position);
        raycaster.ray.origin.y -= 1.5; // Ajuste para a altura das pernas do jogador
        raycaster.ray.direction.set(0, -1, 0); // Aponta para baixo
        
        const intersections = raycaster.intersectObjects(collidableObjects, false);
        const onObject = intersections.length > 0 && intersections[0].distance < 0.5;

        // Gravidade
        velocity.y -= mapConfig.gravity * delta; 

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        // Atrito
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        // Aceleração
        if (moveForward || moveBackward) velocity.z -= direction.z * mapConfig.playerSpeed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * mapConfig.playerSpeed * delta;

        // Aplica colisão com o chão
        if (onObject === true) {
            velocity.y = Math.max(0, velocity.y); // Para de cair
            canJump = true; // Permite pular de novo
        }

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        controls.getObject().position.y += (velocity.y * delta);

        // Segurança extra caso o personagem caia fora do mapa
        if (controls.getObject().position.y < -10) {
            velocity.y = 0;
            controls.getObject().position.set(mapConfig.spawnPoint.x, mapConfig.spawnPoint.y, mapConfig.spawnPoint.z);
        }
    }
    prevTime = time;
    renderer.render(scene, camera);
}