import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { wallMeshes } from './map.js'; 
import { playShootSound } from './audio.js';

export function spawnBots(scene, botsArray, spawnPoints) {
    const loader = new GLTFLoader();

    spawnPoints.forEach((spawnPos, index) => {
        loader.load('models/bot.glb?v=3', (gltf) => {
            const botModel = gltf.scene;
            const animations = gltf.animations;

            botModel.scale.set(0.5, 0.5, 0.5); 
            botModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            botModel.position.copy(spawnPos);
            scene.add(botModel);

            loader.load('models/deagle.glb', (weaponGltf) => {
                const weaponModel = weaponGltf.scene;
                weaponModel.scale.set(0.25, 0.25, 0.25); 
                weaponModel.rotation.set(0, Math.PI / 2, 0); 
                weaponModel.position.set(0.05, -0.05, 0.1);

                let rightHandBone = null;
                botModel.traverse((child) => {
                    if (child.isBone && (child.name.toLowerCase().includes('righthand') || child.name.toLowerCase().includes('hand_r'))) {
                        rightHandBone = child;
                    }
                });
                
                if (rightHandBone) rightHandBone.add(weaponModel);
                else botModel.add(weaponModel);
            });

            let mixer = null;
            if (animations && animations.length > 0) {
                mixer = new THREE.AnimationMixer(botModel);
                const action = mixer.clipAction(animations[0]);
                action.play();
            }

            botsArray.push({
                mesh: botModel,
                initialY: spawnPos.y,
                lastShot: 0,
                strafeDir: 1,
                mixer: mixer
            });
        });
    });
}

export function updateBotLogic(gameMode, isDead, bots, camera, delta, time, takeDamage) {
    if (gameMode !== 'bot' || isDead) return;

    // Laser para visão, colisão e chão
    const sightRay = new THREE.Raycaster();
    const wallRay = new THREE.Raycaster();
    const floorRay = new THREE.Raycaster();

    for (let bot of bots) {
        if (!bot.mesh) continue;
        if (bot.mixer) bot.mixer.update(delta);

        const botEyes = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0));
        const distToPlayer = botEyes.distanceTo(camera.position);
        let hasLOS = false;

        // 1. VISÃO DO BOT
        if (distToPlayer < 75) {
            const dirToTarget = new THREE.Vector3().subVectors(camera.position, botEyes);
            // Proteção contra NaN (Not a Number) se estiver na mesma coordenada
            if (dirToTarget.lengthSq() > 0.01) {
                dirToTarget.normalize();
                sightRay.set(botEyes, dirToTarget);
                const hits = sightRay.intersectObjects(wallMeshes, false);
                if (hits.length === 0 || hits[0].distance >= distToPlayer) {
                    hasLOS = true;
                }
            }
        }

        let moveDir = new THREE.Vector3();
        let moveSpeed = 0;

        // 2. MIRA E COMPORTAMENTO
        if (hasLOS) {
            bot.mesh.lookAt(camera.position.x, bot.mesh.position.y, camera.position.z);

            if (time - bot.lastShot > 1200) { 
                bot.lastShot = time; 
                playShootSound('deagle'); 
                if (Math.random() < Math.max(0.05, 0.35 - (distToPlayer / 100))) {
                    takeDamage(12);
                }
            }
            
            const dirToPlayer = new THREE.Vector3().subVectors(camera.position, bot.mesh.position);
            dirToPlayer.y = 0; 
            
            if (dirToPlayer.lengthSq() > 0.1) {
                dirToPlayer.normalize();
                const strafeVetor = new THREE.Vector3().crossVectors(dirToPlayer, new THREE.Vector3(0,1,0)).normalize();
                moveDir.copy(strafeVetor).multiplyScalar(bot.strafeDir);
                moveSpeed = 3.5 * delta;
            }

            if (Math.random() < 0.02) bot.strafeDir *= -1;
        } else {
            bot.mesh.getWorldDirection(moveDir);
            moveDir.y = 0;
            if (moveDir.lengthSq() > 0.1) moveDir.normalize();
            moveSpeed = 4.5 * delta;
        }

        // 3. MOVIMENTO COM COLISÃO EM PAREDES (RAYCASTER, SEM TRAVAR NO CHÃO)
        if (moveDir.lengthSq() > 0.1) {
            wallRay.set(bot.mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0)), moveDir);
            const wallHits = wallRay.intersectObjects(wallMeshes, false);
            
            if (wallHits.length > 0 && wallHits[0].distance < 1.0) {
                bot.strafeDir *= -1;
                bot.mesh.rotation.y += Math.PI * 0.5; // Vira quando encurralado
            } else {
                bot.mesh.position.addScaledVector(moveDir, moveSpeed);
            }
        }

        // 4. GRAVIDADE EXATA
        floorRay.set(bot.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3(0, -1, 0));
        const floorHits = floorRay.intersectObjects(wallMeshes, false);
        
        if (floorHits.length > 0) {
            bot.mesh.position.y = floorHits[0].point.y; 
        } else {
            bot.mesh.position.y = bot.initialY;
        }
    }
}
