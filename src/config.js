// src/config.js

export const mapConfig = {
    spawnPoint: { x: 0, y: 5, z: 0 }, // Nasce a 5 metros de altura para cair no chão e ativar a gravidade
    gravity: 30.0,
    playerSpeed: 40.0,
    jumpForce: 15.0
};

export const weapons = {
    deagle: { 
        id: 'deagle', 
        damage: 50, 
        scale: 1.0, // Escala perfeita que você mencionou
        posicaoNormal: [0.3, -0.2, -0.5], 
        posicaoMira: [0, -0.15, -0.4], // No centro da tela
        fovMira: 65,
        tempoRecarga: 2000,
        municaoMax: 7,
        reservaMax: 35,
        modelPath: 'assets/deagle.glb' // Mude para o caminho real do seu modelo
    },
    ak47: { 
        id: 'ak47', 
        damage: 36, 
        scale: 0.05, // Exemplo: diminui se o modelo for gigante
        posicaoNormal: [0.4, -0.3, -0.6], 
        posicaoMira: [0, -0.2, -0.4], 
        fovMira: 55, // Zoom maior
        tempoRecarga: 2500,
        municaoMax: 30,
        reservaMax: 90,
        modelPath: 'assets/ak47.glb'
    },
    awp: { 
        id: 'awp', 
        damage: 115, 
        scale: 2.5, // Exemplo: aumenta se o modelo for muito pequeno
        posicaoNormal: [0.4, -0.3, -0.7], 
        posicaoMira: [0, -0.2, -0.4], 
        fovMira: 20, // Zoom de sniper
        tempoRecarga: 3500,
        municaoMax: 10,
        reservaMax: 30,
        modelPath: 'assets/awp.glb'
    }
};