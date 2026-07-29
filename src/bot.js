// src/bot.js
import * as THREE from 'three';
import { wallMeshes, collidables } from './map.js';
import { playShootSound } from './audio.js';

export function updateBotLogic(gameMode, isDead, bots, camera, delta, time, takeDamage) {
    if (gameMode !== 'bot' || isDead) return;

    const botBox = new THREE.Box3();

    for (let bot of bots) {
        if (!bot.mesh) continue;

        const botEyes = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0));
        
        const targetPoints = [
            camera.position.clone(),
            camera.position.clone().add(new THREE.Vector3(0, -0.6, 0)),
            camera.position.clone().add(new THREE.Vector3(0, -1.2, 0))
        ];

        let hasLOS = false;
        const distToPlayer = botEyes.distanceTo(camera.position);

        if (distToPlayer < 75) {
            for (let targetPoint of targetPoints) {
                const dirToTarget = new THREE.Vector3().subVectors(targetPoint, botEyes);
                const distToTarget = dirToTarget.length();
                dirToTarget.normalize();

                const ray = new THREE.Raycaster(botEyes, dirToTarget, 0, distToTarget);
                const hits = ray.intersectObjects(wallMeshes, false);

                if (hits.length === 0) {
                    hasLOS = true;
                    break;
                }
            }
        }

        bot.mesh.lookAt(camera.position.x, bot.mesh.position.y, camera.position.z);

        if (hasLOS) {
            if (time - bot.lastShot > 750) { 
                bot.lastShot = time; 
                playShootSound('deagle'); 
                
                const flashMesh = bot.mesh.children.find(c => c.material && c.material.opacity !== undefined);
                if (flashMesh) {
                    flashMesh.material.opacity = 1.0;
                    setTimeout(() => { flashMesh.material.opacity = 0; }, 50);
                }

                const hitChance = Math.max(0.18, 0.85 - (distToPlayer / 65));
                if (Math.random() < hitChance) {
                    takeDamage(14); 
                }
            }
            
            const dirToPlayer = new THREE.Vector3().subVectors(camera.position, botEyes).normalize();
            const strafeVetor = new THREE.Vector3().crossVectors(dirToPlayer, new THREE.Vector3(0,1,0)).normalize();
            const oldPos = bot.mesh.position.clone();
            bot.mesh.position.addScaledVector(strafeVetor, 3.8 * bot.strafeDir * delta);
            
            botBox.setFromCenterAndSize(bot.mesh.position, new THREE.Vector3(1.0, 1.8, 1.0));
            for (let box of collidables) {
                if (botBox.intersectsBox(box)) { 
                    bot.mesh.position.copy(oldPos); 
                    bot.strafeDir *= -1; 
                    break; 
                }
            }
            if (Math.random() < 0.015) bot.strafeDir *= -1;
        } 
        else {
            const oldPos = bot.mesh.position.clone();
            const moveVetor = new THREE.Vector3();
            bot.mesh.getWorldDirection(moveVetor); moveVetor.y = 0; moveVetor.normalize();

            bot.mesh.position.addScaledVector(moveVetor, 4.8 * delta); 
            
            botBox.setFromCenterAndSize(bot.mesh.position, new THREE.Vector3(1.0, 1.8, 1.0));
            let collides = false;
            for (let box of collidables) {
                if (botBox.intersectsBox(box)) { 
                    collides = true; 
                    break; 
                }
            }
            
            if (collides) {
                bot.mesh.position.copy(oldPos);
                bot.mesh.rotation.y += Math.PI * 0.5 * (bot.strafeDir || 1); 
                bot.strafeDir *= -1;
            }
        }
        bot.pos.copy(bot.mesh.position);
    }
}
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function spawnBots(scene, botsArray, spawnPoints) {
    const loader = new GLTFLoader();

    spawnPoints.forEach((spawnPos, index) => {
        loader.load('models/bot.glb', (gltf) => {
            const botModel = gltf.scene;

            // 🎨 APLICAÇÃO DE SKIN CS (Estilo Agente Tático)
            botModel.traverse((child) => {
                if (child.isMesh) {
                    child.material = new THREE.MeshStandardMaterial({
                        color: 0x333b42,      // Tom cinza militar tático
                        metalness: 0.3,
                        roughness: 0.6
                    });
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            botModel.position.copy(spawnPos);
            scene.add(botModel); // Adiciona na cena para aparecer visível!

            botsArray.push({
                mesh: botModel,
                pos: botModel.position,
                lastShot: 0,
                strafeDir: 1,
                id: index
            });

            console.log(`🤖 Bot ${index} criado com skin e inserido no mapa!`);
        }, undefined, (error) => {
            console.error("Erro ao carregar models/bot.glb:", error);
        });
    });
}
