// audio.js - Sistema completo de áudio para todas as armas

export function playShootSound(weaponKey = 'deagle') {
    try {
        // Toca o som específico da arma atual (ex: sounds/ak47.mp3, sounds/awp.mp3)
        const sound = new Audio(`sounds/${weaponKey}.mp3`);
        sound.volume = 0.5;
        sound.currentTime = 0;
        sound.play().catch(err => {
            console.log("Áudio aguardando interação do usuário:", err);
        });
    } catch (e) {
        console.error("Erro ao reproduzir som de tiro:", e);
    }
}

export function playReloadSound(weaponKey = 'deagle') {
    try {
        // Toca o reload específico da arma atual (ex: sounds/reload_ak47.mp3)
        const sound = new Audio(`sounds/reload_${weaponKey}.mp3`);
        sound.volume = 0.6;
        sound.currentTime = 0;
        sound.play().catch(err => {});
    } catch (e) {
        console.error("Erro ao reproduzir som de recarga:", e);
    }
}

export function playExplosionSound() {
    try {
        const sound = new Audio('sounds/explosion.mp3');
        sound.volume = 0.7;
        sound.currentTime = 0;
        sound.play().catch(() => {});
    } catch (e) {
        console.error("Erro ao reproduzir som de explosão:", e);
    }
}
