import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false;

// Ponto de spawn seguro
export let mapSpawnPoint = new THREE.Vector3(0, 1.0, 0); 

export function buildMapGeometries(scene) {
    collidables.length = 0;
    wallMeshes.length = 0;
    mapWallMeshes.length = 0;
    mapLoaded = false;

    // Luz super forte para garantir visibilidade
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

                child.castShadow = true;
                child.receiveShadow = true;

                wallMeshes.push(child);
                mapWallMeshes.push(child);
                
                // CORREÇÃO: Cria a caixa de colisão física e adiciona pro bot bater nela
                child.geometry.computeBoundingBox();
                const box = new THREE.Box3().setFromObject(child);
                collidables.push(box);
            });

            scene.add(mapModel);
            mapLoaded = true;
            console.log("✅ Mapa carregado com sucesso! Colisões ativadas.");
        },
        undefined,
        (err) => {
            console.error("Erro ao carregar models/mapa.glb:", err);
        }
    );
}
