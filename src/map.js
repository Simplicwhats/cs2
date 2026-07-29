// src/map.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false;

// COORDENADA FIXA DO CHÃO REAL DA DUST2
// (X: 28.33, Y: -5.0 para você cair direto no chão, Z: 24.17)
export let mapSpawnPoint = new THREE.Vector3(28.33, -5.0, 24.17); 

export function buildMapGeometries(scene) {
    collidables.length = 0;
    wallMeshes.length = 0;
    mapWallMeshes.length = 0;
    mapLoaded = false;

    // Luz ambiente para garantir boa iluminação
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

            mapModel.traverse((child) => {
                if (!child.isMesh) return;

                const objName = child.name.toLowerCase();

                // 1. Ignora céus, domos e barreiras invisíveis do topo
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
                
                // 2. FILTRO DE COLISÃO: Ignora tetos/céus altos (só cria colisão para coisas abaixo de Y = 50)
                if (box.max.y < 50) {
                    collidables.push(box);
                }
            });

            // 3. Chão invisível de emergência posicionado no fundo real da fase (Y = -15)
            const solidFloor = new THREE.Mesh(
                new THREE.BoxGeometry(5000, 2, 5000), 
                new THREE.MeshBasicMaterial({ visible: false })
            );
            solidFloor.position.set(0, -15.0, 0);
            solidFloor.updateMatrixWorld(true);
            scene.add(solidFloor);
            collidables.push(new THREE.Box3().setFromObject(solidFloor));

            scene.add(mapModel);
            mapLoaded = true;
            console.log("✅ Mapa carregado com sucesso! Ponto de nascimento:", mapSpawnPoint);
        },
        undefined,
        (err) => {
            console.error("Erro ao carregar models/mapa.glb:", err);
        }
    );
}
