import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false;

// Spawn inicial padrão caso demore a carregar
export let mapSpawnPoint = new THREE.Vector3(28.33, -25.0, 24.17);

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

            const mapBox = new THREE.Box3().setFromObject(mapModel);

            // CORREÇÃO DO SPAWN: Usando o piso real do mapa (min.y) mais uma altura segura de personagem (ex: 2 unidades acima do chão)
            mapSpawnPoint.set(28.33, mapBox.min.y + 2.0, 24.17);

            // Piso invisível de segurança abaixo do mapa
            const floor = new THREE.Mesh(
                new THREE.BoxGeometry(
                    mapBox.max.x - mapBox.min.x + 100,
                    2,
                    mapBox.max.z - mapBox.min.z + 100
                ),
                new THREE.MeshBasicMaterial({ visible: false })
            );

            floor.position.set(
                mapBox.getCenter(new THREE.Vector3()).x,
                mapBox.min.y - 1,
                mapBox.getCenter(new THREE.Vector3()).z
            );

            scene.add(floor);
            collidables.push(new THREE.Box3().setFromObject(floor));

            mapModel.traverse((child) => {
                if (!child.isMesh) return;

                child.castShadow = true;
                child.receiveShadow = true;

                wallMeshes.push(child);
                mapWallMeshes.push(child);

                const box = new THREE.Box3().setFromObject(child);

                // Ignora o teto para o sistema de colisão não te prender lá em cima
                if (box.min.y < mapBox.min.y + 12) {
                    collidables.push(box);
                }
            });

            scene.add(mapModel);
            mapLoaded = true;

            console.log("Mapa carregado com sucesso.");
            console.log("Novo Spawn ajustado:", mapSpawnPoint);
        },
        undefined,
        (err) => {
            console.error("Erro ao carregar o mapa:", err);
        }
    );
}
