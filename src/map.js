// src/map.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false;

// Nascer no céu para evitar ficar preso em caixotes ou paredes
export let mapSpawnPoint = new THREE.Vector3(0, 80.0, 0); 

export function buildMapGeometries(scene) {
    collidables.length = 0;
    wallMeshes.length = 0;
    mapWallMeshes.length = 0;
    mapLoaded = false;

    // Luz super forte para garantir que não seja escuridão do ambiente
    const testLight = new THREE.AmbientLight(0xffffff, 2.5);
    scene.add(testLight);

    const loader = new GLTFLoader();

    loader.load(
        'models/mapa.glb',
        (gltf) => {
            const mapModel = gltf.scene;

            const mapBox = new THREE.Box3().setFromObject(mapModel);
            const center = mapBox.getCenter(new THREE.Vector3());

            mapModel.position.x = -center.x;
            mapModel.position.y = -mapBox.min.y; 
            mapModel.position.z = -center.z;
            mapModel.updateMatrixWorld(true);

            mapModel.traverse((child) => {

    if (!child.isMesh) return;

    child.geometry.computeBoundingBox();

    const box = new THREE.Box3().setFromObject(child);

    collidables.push(box);

    wallMeshes.push(child);
    mapWallMeshes.push(child);

});

           scene.add(mapModel);

// Atualiza a matriz do mapa
mapModel.updateMatrixWorld(true);

// Calcula o tamanho do mapa já posicionado
const mapBox = new THREE.Box3().setFromObject(mapModel);

// Define um spawn
mapSpawnPoint.set(
    mapBox.getCenter(new THREE.Vector3()).x,
    mapBox.max.y + 2,
    mapBox.getCenter(new THREE.Vector3()).z
);

mapLoaded = true;

console.log("Spawn:", mapSpawnPoint);
console.log("✅ Mapa carregado!");
        },
        undefined,
        (err) => {
            console.error("Erro ao carregar models/mapa.glb:", err);
        }
    );
}
