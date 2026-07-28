// audio.js - Usando arquivos de áudio reais (.mp3)

export function playShootSound() {
    try {
        // Carrega o arquivo de som da pasta sounds
        const sound = new Audio('sounds/pistol.mp3');
        sound.volume = 0.5; // Ajuste o volume (0.0 até 1.0)
        
        // Reproduz o som permitindo sobreposição (caso atire muito rápido)
        sound.currentTime = 0;
        sound.play().catch(err => {
            // Os navegadores bloqueiam autoplay até o usuário interagir/clicar na tela
            console.log("Áudio aguardando interação do usuário:", err);
        });
    } catch (e) {
        console.error("Erro ao reproduzir som de tiro:", e);
    }
}

export function playExplosionSound() {
    try {
        const sound = new Audio('sounds/explosion.mp3');
        sound.volume = 0.7;
        sound.currentTime = 0;
        sound.play().catch(() => {});
    } catch (e) {}
}

export function playReloadSound() {
    try {
        const sound = new Audio('sounds/reload.mp3');
        sound.volume = 0.6;
        sound.currentTime = 0;
        sound.play().catch(() => {});
    } catch (e) {}
}
