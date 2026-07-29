// src/map.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false;
export let mapSpawnPoint = new THREE.Vector3(0, 10, 0); 

export function buildMapGeometries(scene) {
    collidables.length = 0;
    wallMeshes.length = 0;
    mapWallMeshes.length = 0;
    mapLoaded = false;

    // Luz ambiente para clarear o mapa
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

            const validBox = new THREE.Box3();
            let hasValidMeshes = false;

            mapModel.traverse((child) => {
                if (!child.isMesh) return;

                // 1. FILTRO: Ignora céus e barreiras invisíveis para não criar chão no alto
                const objName = child.name.toLowerCase();
                if (objName.includes('sky') || objName.includes('barrier') || objName.includes('clip') || objName.includes('cel')) {
                    child.visible = false;
                    return; // Sai da função antes de adicionar colisão nisso
                }

                if (child.material) {
                    child.material.side = THREE.DoubleSide; // Renderiza os dois lados da textura
                }

                child.castShadow = true;
                child.receiveShadow = true;

                wallMeshes.push(child);
                mapWallMeshes.push(child);

                const box = new THREE.Box3().setFromObject(child);
                
                // Calcula o tamanho real da área jogável
                if (!hasValidMeshes) {
                    validBox.copy(box);
                    hasValidMeshes = true;
                } else {
                    validBox.union(box);
                }

                const height = box.max.y - box.min.y;
                
                // Adiciona colisão apenas em objetos menores, ignorando domos gigantes
                if (height < 50) {
                    collidables.push(box);
                }
            });

            // 2. Calcula o centro geométrico da área jogável
            const center = validBox.getCenter(new THREE.Vector3());
            
            // 3. NOVO SPAWN: Agora nasce no centro, um pouco acima do chão médio (e não no topo do mapa!)
            mapSpawnPoint.set(center.x, center.y + 5.0, center.z); 

            // Chão de segurança embaixo do mapa inteiro
            const solidFloor = new THREE.Mesh(
                new THREE.BoxGeometry(5000, 10, 5000), 
                new THREE.MeshBasicMaterial({ visible: false })
            );
            solidFloor.position.set(center.x, validBox.min.y - 1.0, center.z);
            solidFloor.updateMatrixWorld(true);
            scene.add(solidFloor);
            collidables.push(new THREE.Box3().setFromObject(solidFloor));

            scene.add(mapModel);
            mapLoaded = true;
            console.log("✅ Mapa corrigido! Novo Spawn gerado:", mapSpawnPoint);
        },
        undefined,
        (err) => {
            console.error("Erro ao carregar models/mapa.glb:", err);
        }
    );
}
