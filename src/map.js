// src/map.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false;

// Ponto de nascimento zerado no centro
export let mapSpawnPoint = new THREE.Vector3(0, 3.0, 0); 

export function buildMapGeometries(scene) {
    collidables.length = 0;
    wallMeshes.length = 0;
    mapWallMeshes.length = 0;
    mapLoaded = false;

    const testLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(testLight);

    const loader = new GLTFLoader();

    loader.load(
        'models/mapa.glb',
        (gltf) => {
            const mapModel = gltf.scene;

            // 1. MEDE O TAMANHO REAL DO MAPA
            const mapBox = new THREE.Box3().setFromObject(mapModel);
            const center = mapBox.getCenter(new THREE.Vector3());

            // 2. FORÇA O MAPA A IR PARA O CENTRO (0,0,0) E O CHÃO PARA Y=0
            // Resolve mapas que foram exportados a 1000m de distância!
            mapModel.position.x = -center.x;
            mapModel.position.y = -mapBox.min.y; // Coloca o piso em Y = 0
            mapModel.position.z = -center.z;
            mapModel.updateMatrixWorld(true);

            // 3. JOGADOR NASCE NO CENTRO ZERADO E POUCO ACIMA DO CHÃO
            mapSpawnPoint.set(0, 3.0, 0);

            mapModel.traverse((child) => {
                if (!child.isMesh) return;

                const objName = child.name.toLowerCase();

                // Esconde céus e barreiras do modelo
                if (objName.includes('sky') || objName.includes('barrier') || objName.includes('clip') || objName.includes('cel') || objName.includes('dome')) {
                    child.visible = false;
                    return;
                }

                if (child.material) {
                    child.material.side = THREE.DoubleSide;
                }

                child.castShadow = true;
                child.receiveShadow = true;

                wallMeshes.push(child);
                mapWallMeshes.push(child);

                const box = new THREE.Box3().setFromObject(child);
                
                // Só gera colisão para paredes/caixas reais (descarta tetos gigantes)
                const height = box.max.y - box.min.y;
                if (height < 60) {
                    collidables.push(box);
                }
            });

            // Chão invisível de emergência logo abaixo do chão do mapa (Y = -2)
            const solidFloor = new THREE.Mesh(
                new THREE.BoxGeometry(5000, 2, 5000), 
                new THREE.MeshBasicMaterial({ visible: false })
            );
            solidFloor.position.set(0, -2.0, 0);
            solidFloor.updateMatrixWorld(true);
            scene.add(solidFloor);
            collidables.push(new THREE.Box3().setFromObject(solidFloor));

            scene.add(mapModel);
            mapLoaded = true;
            console.log("✅ Mapa reposicionado com sucesso no ponto (0, 0, 0)!");
        },
        undefined,
        (err) => {
            console.error("Erro ao carregar models/mapa.glb:", err);
        }
    );
}
