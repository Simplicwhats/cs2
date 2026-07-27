import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false; 

// Posição calculada para o jogador nascer perfeitamente
export let mapSpawnPoint = new THREE.Vector3(0, 5, 0);

export function buildMapGeometries(scene) {
    collidables.length = 0; 
    wallMeshes.length = 0; 
    mapWallMeshes.length = 0;
    mapLoaded = false;

    const loader = new GLTFLoader();
    
    loader.load('models/mapa.glb', (gltf) => {
    const mapModel = gltf.scene;
    mapModel.scale.set(1, 1, 1); 
    mapModel.position.set(0, 0, 0);
    
    // >>> DEFININDO UM SPAWN MANUAL SEGURO PARA O CS_OFFICE <<<
    // Se ainda cair no void, altere o valor de Y para 10, 20 ou 30
    mapSpawnPoint.set(0, 15, 0); 

    mapModel.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            const box = new THREE.Box3().setFromObject(child);
            box.userData = { mesh: child };
            collidables.push(box);
            wallMeshes.push(child);
            mapWallMeshes.push(child);
        }
    });
    
    scene.add(mapModel);
    mapLoaded = true;
}, undefined, (error) => {
    console.error("ERRO ao carregar o mapa:", error);
});
