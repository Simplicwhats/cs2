import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];
export let mapLoaded = false; 

export function buildMapGeometries(scene) {
    collidables.length = 0; 
    wallMeshes.length = 0; 
    mapWallMeshes.length = 0;
    mapLoaded = false;

    // Chão invisível de segurança caso o modelo não carregue
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    const loader = new GLTFLoader();
    
    // CARREGA O MAPA 3D DA PASTA MODELS
   loader.load('models/mapa.glb', (gltf) => {
        const mapModel = gltf.scene;
        
        mapModel.scale.set(1, 1, 1); 
        mapModel.position.set(0, 0, 0);
        
        mapModel.traverse((child) => {
            if (child.isMesh) {
                // 1. DESLIGAMOS AS SOMBRAS (Para evitar que o mapa fique escuro)
                child.castShadow = false;
                child.receiveShadow = false;
                
                const box = new THREE.Box3().setFromObject(child);
                box.userData = { mesh: child };
                collidables.push(box);
                wallMeshes.push(child);
                mapWallMeshes.push(child);
            }
        });
        
        // 2. ADICIONA O MAPA À CENA
        // DICA: Se a tela CONTINUAR preta após salvar, coloque duas barras na frente 
        // da linha abaixo para esconder o mapa inteiro: // scene.add(mapModel);
        scene.add(mapModel);
        
        mapLoaded = true;
        console.log("Mapa 3D carregado com sucesso!");
    }, undefined, (error) => {
        console.error("ERRO: Modelo 'models/mapa.glb' não encontrado! Coloque o arquivo na pasta.", error);
    });
}
