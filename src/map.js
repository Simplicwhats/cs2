// src/map.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false;

// Você vai nascer no alto e cair de paraquedas no chão invisível
export let mapSpawnPoint = new THREE.Vector3(0, 30.0, 0); 

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

            // 1. Centraliza o mapa
            const mapBox = new THREE.Box3().setFromObject(mapModel);
            const center = mapBox.getCenter(new THREE.Vector3());

            mapModel.position.x = -center.x;
            mapModel.position.y = -mapBox.min.y; 
            mapModel.position.z = -center.z;
            mapModel.updateMatrixWorld(true);

            mapModel.traverse((child) => {
                if (!child.isMesh) return;

                if (child.name.toLowerCase().includes('sky')) {
                    child.visible = false;
                    return;
                }

                if (child.material) {
                    child.material.side = THREE.DoubleSide;
                }

                wallMeshes.push(child);
                mapWallMeshes.push(child);

                // ❌ O SEGREDO ESTÁ AQUI: Removemos as paredes da colisão Box3!
                // Isso impede que o mapa vire um bloco maciço que te joga pro teto.
            });

            // ✅ 2. CHÃO INVISÍVEL (O único objeto sólido do jogo agora)
            const solidFloor = new THREE.Mesh(
                new THREE.BoxGeometry(5000, 2, 5000), 
                new THREE.MeshBasicMaterial({ visible: false }) 
            );
            
            // ⚠️ ALTURA DO CHÃO (Y = 10.0): Ajuste esse número se você estiver afundando ou flutuando!
            solidFloor.position.set(0, 10.0, 0); 
            solidFloor.updateMatrixWorld(true);
            scene.add(solidFloor);
            
            // Apenas o chão invisível tem colisão agora
            collidables.push(new THREE.Box3().setFromObject(solidFloor));

            scene.add(mapModel);
            mapLoaded = true;
            console.log("✅ Colisão das paredes desativada! Chão invisível gerado na altura Y = 10.0");
        },
        undefined,
        (err) => {
            console.error("Erro ao carregar models/mapa.glb:", err);
        }
    );
}
