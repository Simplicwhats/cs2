// src/bot.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { wallMeshes, collidables } from './map.js';
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

            loader.load('models/ak47.glb', (weaponGltf) => {
                const weaponModel = weaponGltf.scene;
                weaponModel.scale.set(0.25, 0.25, 0.25); 
                weaponModel.rotation.set(0, Math.PI / 2, 0); 
                weaponModel.position.set(0.05, -0.05, 0.1);

                let rightHandBone = null;
                botModel.traverse((child) => {
                    if (child.isBone) {
                        const boneName = child.name.toLowerCase();
                        if (boneName.includes('righthand') || boneName.includes('hand_r') || boneName.includes('right_hand')) {
                            rightHandBone = child;
                        }
                    }
                });

                if (rightHandBone) {
                    rightHandBone.add(weaponModel);
                } else {
                    botModel.add(weaponModel);
                }
            }, undefined, (err) => {
                console.error("Erro ao carregar a arma para o bot:", err);
            });

            let mixer = null;
            let actions = {};
            
            if (animations && animations.length > 0) {
                mixer = new THREE.AnimationMixer(botModel);
                animations.forEach((clip) => {
                    const action = mixer.clipAction(clip);
                    actions[clip.name.toLowerCase()] = action;
                });

                const defaultClip = animations.find(clip => {
                    const name = clip.name.toLowerCase();
                    return name.includes('run') || name.includes('walk') || name.includes('idle');
                }) || animations[0];

                if (defaultClip) {
                    const defaultAction = mixer.clipAction(defaultClip);
                    defaultAction.play();
                }
            }

            botsArray.push({
                mesh: botModel,
                pos: botModel.position,
                initialY: spawnPos.y, // 📌 GRAVA A ALTURA EXATA DO CHÃO PARA ELE NÃO AFUNDAR
                lastShot: 0,
                strafeDir: 1,
                id: index,
                mixer: mixer,
                actions: actions
            });

            console.log(`🤖 Bot ${index} criado com sucesso no mapa!`);
        });
    });
}

export function updateBotLogic(gameMode, isDead, bots, camera, delta, time, takeDamage) {
    if (gameMode !== 'bot' || isDead) return;

    const raycaster = new THREE.Raycaster();
    const botBox = new THREE.Box3();

    for (let bot of bots) {
        if (!bot.mesh) continue;

        if (bot.mixer) bot.mixer.update(delta);

        const botEyes = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0));
        const distToPlayer = botEyes.distanceTo(camera.position);

        // 1. VISÃO DO BOT
        let hasLOS = false;
        if (distToPlayer < 75) {
            const dirToTarget = new THREE.Vector3().subVectors(camera.position, botEyes);
            const distToTarget = dirToTarget.length();
            dirToTarget.normalize();

            raycaster.set(botEyes, dirToTarget);
            const hits = raycaster.intersectObjects(wallMeshes, true);

            // Só te vê se não tiver parede na frente
            if (hits.length === 0 || hits[0].distance >= distToTarget) {
                hasLOS = true;
            }
        }

        bot.mesh.lookAt(camera.position.x, bot.mesh.position.y, camera.position.z);

        let moveDir = new THREE.Vector3();
        let moveSpeed = 0;

        // 2. COMPORTAMENTO E MIRA
        if (hasLOS) {
            // 🎯 NERF DA MIRA: Agora atira mais devagar (a cada 1.2s) e erra muito mais
            if (time - bot.lastShot > 1200) { 
                bot.lastShot = time; 
                playShootSound('deagle'); 
                
                // Chance máxima de 35% de perto, caindo até 5% de longe
                const hitChance = Math.max(0.05, 0.35 - (distToPlayer / 100));
                
                if (Math.random() < hitChance) {
                    takeDamage(12); // Dano reduzido
                }
            }
            
            const dirToPlayer = new THREE.Vector3().subVectors(camera.position, bot.mesh.position).normalize();
            dirToPlayer.y = 0;
            const strafeVetor = new THREE.Vector3().crossVectors(dirToPlayer, new THREE.Vector3(0,1,0)).normalize();
            moveDir.copy(strafeVetor).multiplyScalar(bot.strafeDir);
            moveSpeed = 3.5 * delta;

            if (Math.random() < 0.02) bot.strafeDir *= -1;
        } 
        else {
            bot.mesh.getWorldDirection(moveDir);
            moveDir.y = 0;
            moveDir.normalize();
            moveSpeed = 4.5 * delta;
        }

        // 3. MOVIMENTAÇÃO COM COLISÃO ABSOLUTA (Não atravessa paredes)
        const oldPos = bot.mesh.position.clone();
        
        // Testa andar no eixo X
        bot.mesh.position.x += moveDir.x * moveSpeed;
        botBox.setFromCenterAndSize(bot.mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0)), new THREE.Vector3(1.2, 1.8, 1.2));
        let hitWallX = false;
        for (let box of collidables) {
            if (botBox.intersectsBox(box)) { hitWallX = true; break; }
        }
        if (hitWallX) {
            bot.mesh.position.x = oldPos.x; // Bateu na parede? Volta o passo.
            bot.strafeDir *= -1;
            if (!hasLOS) bot.mesh.rotation.y += Math.PI * 0.5; // Vira se estiver patrulhando
        }

        // Testa andar no eixo Z
        bot.mesh.position.z += moveDir.z * moveSpeed;
        botBox.setFromCenterAndSize(bot.mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0)), new THREE.Vector3(1.2, 1.8, 1.2));
        let hitWallZ = false;
        for (let box of collidables) {
            if (botBox.intersectsBox(box)) { hitWallZ = true; break; }
        }
        if (hitWallZ) {
            bot.mesh.position.z = oldPos.z; // Bateu na parede? Volta o passo.
            bot.strafeDir *= -1;
            if (!hasLOS) bot.mesh.rotation.y += Math.PI * 0.5;
        }

        // 📌 TRAVA DE PISO: Impede que ele afunde ou voe (Mantém a altura de onde nasceu)
        bot.mesh.position.y = bot.initialY;

        bot.pos.copy(bot.mesh.position);
    }
}
