# 🎮 FPS Web Game 3D

Um jogo de tiro em primeira pessoa (FPS) 3D leve e rápido, rodando diretamente no navegador! Desenvolvido com **HTML, CSS e JavaScript puro**, utilizando a biblioteca **Three.js** para renderização gráfica e **PeerJS** para futuras implementações multiplayer.

## ✨ Funcionalidades
* **Gráficos 3D no Navegador:** Renderização fluida usando WebGL via Three.js.
* **Sistema de Colisão e Física Básico:** Movimentação, pulo, agachamento e colisão com paredes/rampas.
* **Inteligência Artificial (Bots):** Modo de treino com Bots que patrulham, detectam o jogador e atiram.
* **Sistema de Armas e Economia:** Menu de compra (Loja) com dinheiro ganho a cada eliminação. Armas com diferentes atributos (dano, cadência, recuo, capacidade de munição).
* **Áudio Dinâmico:** Efeitos sonoros gerados via Web Audio API (sem necessidade de baixar arquivos `.mp3`).

## 🚀 Como Executar o Jogo

Como o projeto utiliza **ES6 Modules** (`import` / `export` no JavaScript), você **não pode** simplesmente dar um duplo clique no arquivo `index.html` (isso gerará um erro de *CORS* no navegador). 

Você precisa rodar o jogo através de um servidor web local. Aqui estão as formas mais fáceis:

### Opção 1: VS Code (Recomendado)
1. Abra a pasta do projeto no **Visual Studio Code**.
2. Instale a extensão **Live Server**.
3. Clique com o botão direito no arquivo `index.html` e selecione **"Open with Live Server"**.

### Opção 2: Python
Se você tem Python instalado, abra o terminal na pasta do projeto e rode:
* Para Python 3: `python -m http.server 8000`
* Acesse no navegador: `http://localhost:8000`

### Opção 3: Node.js
Se você tem Node.js instalado, use o pacote `serve`:
* No terminal, rode: `npx serve .`
* Acesse o link gerado no terminal.

## ⌨️ Controles

| Tecla / Botão | Ação |
| :--- | :--- |
| **W, A, S, D** | Movimentação |
| **W (Duplo)** | Correr (Sprint) |
| **Ctrl** | Agachar |
| **Espaço** | Pular |
| **Mouse Esc.** | Atirar |
| **Mouse Dir.** | Mirar (Reduz a sensibilidade) |
| **R** | Recarregar Arma |
| **1 / 2** | Trocar de Arma (Primária / Secundária) |
| **B** | Abrir/Fechar Loja (Menu de Compra) |

## 📂 Estrutura do Projeto

O código foi refatorado para ser modular e fácil de manter:

```text
cs2/
├── index.html        # Estrutura da página, UI (Menus, HUD, Loja) e importação de scripts
├── style.css         # Estilização de toda a interface do jogo
├── README.md         # Documentação do projeto
└── src/
    ├── main.js       # Loop principal do jogo, controles, física e renderização
    ├── config.js     # Configuração de status das armas, preços e pontos de spawn
    ├── map.js        # Geração procedural do mapa 3D, texturas e arrays de colisão
    ├── bot.js        # Lógica de inteligência artificial, detecção de visão e movimentação
    └── audio.js      # Sintetizador de efeitos sonoros (Tiros, recarga, explosões)