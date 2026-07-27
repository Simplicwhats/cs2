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
        
        // 1. CALCULA A CAIXA TOTA DO MAPA (BOUNDING BOX)
        const mapBox = new THREE.Box3().setFromObject(mapModel);
        const center = new THREE.Vector3();
        mapBox.getCenter(center);
        
        // 2. DEFINE O SPAWN NO CENTRO DO MAPA, LIGEIRAMENTE ACIMA DO PONTO MAIS ALTO/MEDIO
        mapSpawnPoint.set(center.x, mapBox.max.y + 2, center.z);
        
        console.log("==========================================");
        console.log("📌 SPAWN RECOMENDADO ENCONTRADO:");
        console.log(`X: ${center.x.toFixed(2)}, Y: ${(mapBox.max.y + 2).toFixed(2)}, Z: ${center.z.toFixed(2)}`);
        console.log("==========================================");

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
