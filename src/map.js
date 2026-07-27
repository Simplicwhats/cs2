import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false;

export let mapSpawnPoint = new THREE.Vector3(0, 2, 0);

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

            // Descobre o tamanho do mapa
            const mapBox = new THREE.Box3().setFromObject(mapModel);

            // Spawn automático um pouco acima do piso
            mapSpawnPoint.set(
    -1.42,
    1,
    -6.71
);

            // Piso invisível
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

                // Ignora teto
                if (box.min.y < mapBox.min.y + 12) {
                    collidables.push(box);
                }

            });

            scene.add(mapModel);

            mapLoaded = true;

            console.log("Mapa carregado.");
            console.log("Spawn:", mapSpawnPoint);

        },

        undefined,

        (err) => {
            console.error(err);
        }

    );

}
