import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false; 

// Posição calculada para o jogador nascer
export let mapSpawnPoint = new THREE.Vector3(0, 15, 0);

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
        
        // Spawn manual seguro para o cs_office
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
        console.error("ERRO: Modelo 'models/mapa.glb' não encontrado!", error);
    });
}
