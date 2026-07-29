// src/map.js
import * as THREE from 'three';

export const collidableObjects = []; // Array que o raycaster vai checar

export function createMap(scene) {
    // Criação do chão (Floor)
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    
    floor.rotation.x = -Math.PI / 2; // Deita o plano para virar chão
    floor.position.y = 0; // Altura zero
    
    scene.add(floor);
    collidableObjects.push(floor); // Adiciona ao array de colisão para a gravidade funcionar

    // Criação de algumas caixas para testar colisão e tiro
    const boxGeo = new THREE.BoxGeometry(2, 2, 2);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x883333 });

    for (let i = 0; i < 5; i++) {
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.position.set(Math.random() * 20 - 10, 1, Math.random() * 20 - 10);
        scene.add(box);
        collidableObjects.push(box);
    }
    
    // Luz ambiente básica para enxergar os modelos 3D
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);
}