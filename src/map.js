// src/map.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false;

// COORDENADA DE SPAWN SEGURA DENTRO DO MAPA
export let mapSpawnPoint = new THREE.Vector3(0, 5.0, 0); 

export function buildMapGeometries(scene) {
    collidables.length = 0;
    wallMeshes.length = 0;
    mapWallMeshes.length = 0;
    mapLoaded = false;

    const loader = new GLTFLoader();

    loader.load(
        'models/mapa.glb',
        (gltf) => {
            const mapModel = gltf.scene;

            // Centraliza a malha no ponto zero
            const mapBox = new THREE.Box3().setFromObject(mapModel);
            const center = mapBox.getCenter(new THREE.Vector3());

            mapModel.position.x = -center.x;
            mapModel.position.y = -mapBox.min.y; // Mantém a base no nível zero
            mapModel.position.z = -center.z;
            mapModel.updateMatrixWorld(true);

            mapModel.traverse((child) => {
                if (!child.isMesh) return;

                const objName = child.name.toLowerCase();
                if (objName.includes('sky') || objName.includes('barrier') || objName.includes('clip')) {
                    child.visible = false;
                    return;
                }

                if (child.material) {
                    child.material.side = THREE.DoubleSide;
                }

                child.castShadow = true;
                child.receiveShadow = true;

                // Alimenta a lista que o Raycaster consulta para pisar no chão
                wallMeshes.push(child);
                mapWallMeshes.push(child);
            });

            scene.add(mapModel);
            mapLoaded = true;
            console.log("✅ Mapa e superfícies de solo carregados com sucesso!");
        },
        undefined,
        (err) => {
            console.error("Erro ao carregar models/mapa.glb:", err);
        }
    );
}
