import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false; 

export let mapSpawnPoint = new THREE.Vector3(0, 2, 0); // Spawn inicial seguro no ar, o ray/piso segura depois

export function buildMapGeometries(scene) {
    collidables.length = 0; 
    wallMeshes.length = 0; 
    mapWallMeshes.length = 0;
    mapLoaded = false;

    const loader = new GLTFLoader();
    
    loader.load('models/mapa.glb', (gltf) => {
        const mapModel = gltf.scene;
        
        // CORREÇÃO DE POSIÇÃO/ORIENTAÇÃO DO MAPA:
        // Se o mapa está de cabeça para baixo, podemos inverter o eixo Y ou girá-lo.
        // Tente inverter a escala Y para -1 caso ele esteja espelhado verticalmente:
        mapModel.scale.set(1, -1, 1); 
        
        // Ou se preferir girar 180 graus no eixo X:
        // mapModel.rotation.x = Math.PI;

        mapModel.position.set(0, 0, 0);
        
        // Ajusta o ponto de spawn para uma altura segura considerando a inversão
        mapSpawnPoint.set(0, 5, 0);

        // Piso de segurança invisível caso precise
        const floorGeo = new THREE.BoxGeometry(500, 2, 500);
        const floorMat = new THREE.MeshBasicMaterial({ visible: false });
        const safetyFloor = new THREE.Mesh(floorGeo, floorMat);
        safetyFloor.position.set(0, -10, 0); 
        
        const safetyBox = new THREE.Box3().setFromObject(safetyFloor);
        collidables.push(safetyBox);
        scene.add(safetyFloor);

        mapModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                const box = new THREE.Box3().setFromObject(child);
                collidables.push(box);

                wallMeshes.push(child);
                mapWallMeshes.push(child);
            }
        });
        
        scene.add(mapModel);
        mapLoaded = true;
    }, undefined, (error) => {
        console.error("ERRO: Modelo 'models/mapa.glb' não encontrado!", error);
    });
