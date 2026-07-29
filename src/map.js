// src/map.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false;

// Nascer no céu para evitar ficar preso em caixotes ou paredes
export let mapSpawnPoint = new THREE.Vector3(0, 01.0, 0); 

export function buildMapGeometries(scene) {
    collidables.length = 0;
    wallMeshes.length = 0;
    mapWallMeshes.length = 0;
    mapLoaded = false;

    // Luz super forte para garantir que não seja escuridão do ambiente
    const testLight = new THREE.AmbientLight(0xffffff, 2.5);
    scene.add(testLight);

    const loader = new GLTFLoader();

    loader.load(
        'models/mapa.glb',
        (gltf) => {
            const mapModel = gltf.scene;

            const mapBox = new THREE.Box3().setFromObject(mapModel);
            const center = mapBox.getCenter(new THREE.Vector3());

            mapModel.position.x = -center.x;
            mapModel.position.y = -mapBox.min.y; 
            mapModel.position.z = -center.z;
            mapModel.updateMatrixWorld(true);

            mapModel.traverse((child) => {
                if (!child.isMesh) return;

                const objName = child.name.toLowerCase();
                if (objName.includes('sky') || objName.includes('barrier') || objName.includes('clip')) {
                    child.visible = false;
                    return;
                }

                // REMOVIDO: DoubleSide. Se você nascer dentro de uma parede, 
                // ela ficará transparente por dentro e você enxergará o mapa!

                child.castShadow = true;
                child.receiveShadow = true;

                wallMeshes.push(child);
                mapWallMeshes.push(child);
            });

            scene.add(mapModel);
            mapLoaded = true;
            console.log("✅ Mapa carregado! Câmera caindo do alto...");
        },
        undefined,
        (err) => {
            console.error("Erro ao carregar models/mapa.glb:", err);
        }
    );
}
