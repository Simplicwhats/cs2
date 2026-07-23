# 🎮 FPS Tático 3D (Web Browser)

Um jogo de tiro em primeira pessoa (FPS) 3D feito para navegador utilizando **Three.js** para renderização gráfica e **PeerJS** para conexões multiplayer WebRTC sem necessidade de servidor dedicado.

---

## 📁 Estrutura Modular do Projeto

Para facilitar a manutenção e a inclusão futura de **modelos 3D (.gltf / .glb)** e **armações/animações de personagens**, o código foi dividido em módulos ES6 dentro da pasta `src/`:

```text
meu-jogo-fps/
├── index.html          # Interface do usuário (HUD, menus e canvas 3D)
├── style.css           # Estilização visual dos elementos do jogo
├── README.md           # Documentação do projeto
└── src/
    ├── config.js       # Configurações de armas, preços, atributos e spawns
    ├── audio.js        # Efeitos sonoros procedimentais (Web Audio API)
    ├── textures.js     # Gerador procedural de texturas para paredes e pisos
    ├── map.js          # Construção de mapas, prédios, rampas e colisões
    ├── bot.js          # Inteligência Artificial dos Bots (campo de visão e patrulha)
    ├── weapons.js      # Modelagem procedural de armas, tiros, miras e recoil
    ├── player.js       # Controle de vida, dano, loja e estado do jogador
    ├── network.js      # Gerenciamento de conexões multiplayer WebRTC (PeerJS)
    └── main.js         # Loop principal e orquestrador dos módulos