// src/map.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false;

// Começa zerado, vamos calcular dinamicamente depois
export let mapSpawnPoint = new THREE.Vector3(0, 10, 0); 

export function buildMapGeometries(scene) {
    collidables.length = 0;
    wallMeshes.length = 0;
    mapWallMeshes.length = 0;
    mapLoaded = false;

    // Luz ambiente para garantir que você enxergue o mapa se nascer dentro de uma parede
    const testLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(testLight);

    const loader = new GLTFLoader();

    loader.load(
        'models/mapa.glb',
        (gltf) => {
            const mapModel = gltf.scene;

            mapModel.position.set(0, 0, 0);
            mapModel.scale.set(1, 1, 1);
            mapModel.updateMatrixWorld(true);

            // 1. Pega as dimensões reais do seu mapa
            const mapBox = new THREE.Box3().setFromObject(mapModel);
            const center = mapBox.getCenter(new THREE.Vector3());

            // 2. Define o Spawn exatamente no centro geográfico do mapa, um pouco acima do chão
            mapSpawnPoint.set(center.x, mapBox.max.y + 5.0, center.z);
            console.log("📍 Novo Spawn calculado:", mapSpawnPoint);

            const solidFloor = new THREE.Mesh(
                new THREE.BoxGeometry(5000, 10, 5000), 
                new THREE.MeshBasicMaterial({ visible: false })
            );

            solidFloor.position.set(center.x, mapBox.min.y - 5.0, center.z);
            solidFloor.updateMatrixWorld(true);
            scene.add(solidFloor);
            collidables.push(new THREE.Box3().setFromObject(solidFloor));

            mapModel.traverse((child) => {
                if (!child.isMesh) return;
                
                // Força os materiais a renderizarem os dois lados (evita paredes invisíveis)
                if (child.material) {
                    child.material.side = THREE.DoubleSide;
                }

                child.castShadow = true;
                child.receiveShadow = true;

                wallMeshes.push(child);
                mapWallMeshes.push(child);

                const box = new THREE.Box3().setFromObject(child);
                const height = box.max.y - box.min.y;
                
                if (height < 50) {
                    collidables.push(box);
                }
            });

            scene.add(mapModel);
            mapLoaded = true;
            console.log("✅ Mapa carregado e jogador posicionado no centro!");
        },
        undefined,
        (err) => {
            console.error("Erro ao carregar models/mapa.glb:", err);
        }
    );
}
