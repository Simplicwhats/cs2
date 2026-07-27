import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false;

// Spawn ajustado com o Y negativo validado nos testes anteriores
export let mapSpawnPoint = new THREE.Vector3(28.33, -7.0, 24.17); 

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

            // Piso de segurança contra o void (calculado com base na altura real do mapa)
            const solidFloor = new THREE.Mesh(
                new THREE.BoxGeometry(5000, 10, 5000), 
                new THREE.MeshBasicMaterial({ visible: false })
            );

            solidFloor.position.set(
                mapBox.getCenter(new THREE.Vector3()).x,
                mapBox.min.y - 5.0,
                mapBox.getCenter(new THREE.Vector3()).z
            );
            
            solidFloor.updateMatrixWorld(true);
            scene.add(solidFloor);
            collidables.push(new THREE.Box3().setFromObject(solidFloor));

            mapModel.traverse((child) => {
                if (!child.isMesh) return;

                const objName = child.name.toLowerCase();
                if (objName.includes('sky') || objName.includes('barrier') || objName.includes('cel')) return;

                child.castShadow = true;
                child.receiveShadow = true;

                wallMeshes.push(child);
                mapWallMeshes.push(child);

                const box = new THREE.Box3().setFromObject(child);
                const height = box.max.y - box.min.y;
                
                // Filtra tetos e barreiras colossais para proteger a colisão do jogador
                if (height < 50) {
                    collidables.push(box);
                }
            });

            scene.add(mapModel);
            mapLoaded = true;
            console.log("Mapa carregado com sucesso e spawn sincronizado.");
        },
        undefined,
        (err) => {
            console.error("Erro ao carregar o mapa:", err);
        }
    );
}
