import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false;

// Altura perfeita que você descobriu (Y = 9.14) com X e Z do seu spawn
export let mapSpawnPoint = new THREE.Vector3(28.33, -9.14, 24.17);

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

            // CRIAÇÃO DE UM PISO SÓLIDO INVISÍVEL EXATAMENTE ABAIXO DOS SEUS PÉS (Y = 9.14)
            // Subtraímos um pouco no Y para que a caixa de colisão fique perfeitamente alinhada como o chão
            const solidFloor = new THREE.Mesh(
                new THREE.BoxGeometry(
                    mapBox.max.x - mapBox.min.x + 200,
                    2, // Espessura do piso
                    mapBox.max.z - mapBox.min.z + 200
                ),
                new THREE.MeshBasicMaterial({ visible: false }) // Invisível, mas sólido
            );

            // Posiciona o piso invisível exatamente logo abaixo de Y = 9.14 (ex: em Y = 8.5 ou 9.0)
            solidFloor.position.set(
                mapBox.getCenter(new THREE.Vector3()).x,
                -9.0, // <-- Altura exata calculada para o seu pé bater e parar
                mapBox.getCenter(new THREE.Vector3()).z
            );

            scene.add(solidFloor);
            collidables.push(new THREE.Box3().setFromObject(solidFloor));

            mapModel.traverse((child) => {
                if (!child.isMesh) return;

                child.castShadow = true;
                child.receiveShadow = true;

                wallMeshes.push(child);
                mapWallMeshes.push(child);

                const box = new THREE.Box3().setFromObject(child);

                // Adiciona colisão nas paredes e outros objetos, ignorando tetos muito altos
                if (box.min.y < mapBox.min.y + 12) {
                    collidables.push(box);
                }
            });

            scene.add(mapModel);
            mapLoaded = true;

            console.log("Mapa carregado. Piso sólido forçado criado com sucesso.");
        },
        undefined,
        (err) => {
            console.error("Erro ao carregar o mapa:", err);
        }
    );
}
