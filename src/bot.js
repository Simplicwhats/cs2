// src/bot.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { wallMeshes, collidables } from './map.js';
import { playShootSound } from './audio.js';

export function spawnBots(scene, botsArray, spawnPoints) {
    const loader = new GLTFLoader();

    spawnPoints.forEach((spawnPos, index) => {
        loader.load('models/bot.glb', (gltf) => {
            const botModel = gltf.scene;
            const animations = gltf.animations;

            // 🎨 Ajustes visuais do bot (mantendo texturas originais ou aplicando estilo)
            botModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            botModel.position.copy(spawnPos);
            scene.add(botModel);

            // 🔫 CARREGA E ENCAIXA A ARMA NA MÃO DO BOT
            loader.load('models/deagle.glb', (weaponGltf) => {
                const weaponModel = weaponGltf.scene;
                
                // Escala e rotação para encaixar perfeitamente na mão
                weaponModel.scale.set(0.25, 0.25, 0.25); 
                // Ajuste os valores de rotação/posição caso fique invertido no seu modelo
                weaponModel.rotation.set(0, Math.PI / 2, 0); 
                weaponModel.position.set(0.05, -0.05, 0.1);

                // Procura o osso da mão direita no esqueleto do bot
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
                    console.log(`🔫 Arma anexada à mão do Bot ${index}!`);
                } else {
                    // Fallback: se não achar o osso exato, coloca na raiz do bot
                    botModel.add(weaponModel);
                    console.warn(`⚠️ Osso da mão não encontrado para o Bot ${index}. Arma colocada na raiz.`);
                }
            }, undefined, (err) => {
                console.error("Erro ao carregar a arma para o bot:", err);
            });

            // 🎬 CONFIGURAÇÃO DO MIXER DE ANIMAÇÃO DO BOT
            let mixer = null;
            let actions = {};
            
            if (animations && animations.length > 0) {
                mixer = new THREE.AnimationMixer(botModel);
                
                animations.forEach((clip) => {
                    const action = mixer.clipAction(clip);
                    actions[clip.name.toLowerCase()] = action;
                });

                const defaultAction = actions['run'] || actions['walk'] || actions['idle'] || actions[0];
                if (defaultAction) {
                    defaultAction.play();
                }
            }

            botsArray.push({
                mesh: botModel,
                pos: botModel.position,
                lastShot: 0,
                strafeDir: 1,
                id: index,
                mixer: mixer,
                actions: actions
            });

            console.log(`🤖 Bot ${index} criado com sucesso no mapa!`);
        }, undefined, (error) => {
            console.error("Erro ao carregar models/bot.glb:", error);
        });
    });
}
