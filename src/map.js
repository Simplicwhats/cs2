import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false;

// Spawn ajustado: Y = 2.0 força você a nascer "caindo" levemente no chão para fixar a colisão
export let mapSpawnPoint = new THREE.Vector3(28.33, 2.0, 24.17); 

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

            mapModel.position.set(0, 0, 0);
            mapModel.rotation.set(0, 0, 0);
            mapModel.scale.set(1, 1, 1);
            
            mapModel.updateMatrixWorld(true);

            const mapBox = new THREE.Box3().setFromObject(mapModel);

            // Piso de segurança GIGANTE logo abaixo do mapa para evitar o "void"
            const solidFloor = new THREE.Mesh(
                new THREE.BoxGeometry(2000, 5, 2000), 
                new THREE.MeshBasicMaterial({ visible: false })
            );

            // Posiciona o piso exatamente no limite inferior do modelo 3D
            solidFloor.position.set(
                mapBox.getCenter(new THREE.Vector3()).x,
                mapBox.min.y - 2.5, // Centraliza a espessura de 5 unidades do piso
                mapBox.getCenter(new THREE.Vector3()).z
            );
            
            solidFloor.updateMatrixWorld(true);
            scene.add(solidFloor);
            
            // Adiciona o chão de segurança nas colisões
            collidables.push(new THREE.Box3().setFromObject(solidFloor));

            mapModel.traverse((child) => {
                if (!child.isMesh) return;

                child.castShadow = true;
                child.receiveShadow = true;

                wallMeshes.push(child);
                mapWallMeshes.push(child);

                const box = new THREE.Box3().setFromObject(child);
                if (box.min.y < mapBox.min.y + 12) {
                    collidables.push(box);
                }
            });

            scene.add(mapModel);
            mapLoaded = true;
            console.log("Mapa carregado. Piso sólido de segurança ativado.");
        },
        undefined,
        (err) => {
            console.error("Erro ao carregar o mapa:", err);
        }
    );
}
