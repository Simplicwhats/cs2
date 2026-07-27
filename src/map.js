import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false; 

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
        
        mapSpawnPoint.set(0, 15, 0);

        // Cria um piso de segurança invisível grande caso o modelo .glb não tenha colisão sólida detectável
        const floorGeo = new THREE.BoxGeometry(200, 1, 200);
        const floorMat = new THREE.MeshBasicMaterial({ visible: false });
        const safetyFloor = new THREE.Mesh(floorGeo, floorMat);
        safetyFloor.position.set(0, -1, 0); // Fica logo abaixo do mapa
        
        const safetyBox = new THREE.Box3().setFromObject(safetyFloor);
        collidables.push(safetyBox);
        scene.add(safetyFloor);

        mapModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Evita que objetos pequenos/teto sirvam de colisão total que bloqueie o player
                const box = new THREE.Box3().setFromObject(child);
                
                // Adiciona apenas elementos sólidos relevantes à colisão
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
