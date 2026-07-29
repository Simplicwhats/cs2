// src/audio.js
export function playShootSound(weaponKey = 'deagle') {
    try {
        const sound = new Audio(`sounds/${weaponKey}.mp3`);
        sound.volume = 0.5;
        sound.currentTime = 0;
        sound.play().catch(err => {
            console.log("Áudio aguardando interação:", err);
        });
    } catch (e) {
        console.error("Erro ao reproduzir tiro:", e);
    }
}

export function playReloadSound(weaponKey = 'deagle') {
    try {
        const sound = new Audio(`sounds/reload_${weaponKey}.mp3`);
        sound.volume = 0.6;
        sound.currentTime = 0;
        sound.play().catch(() => {});
    } catch (e) {
        console.error("Erro ao reproduzir recarga:", e);
    }
}

export function playExplosionSound() {
    try {
        const sound = new Audio('sounds/explosion.mp3');
        sound.volume = 0.7;
        sound.currentTime = 0;
        sound.play().catch(() => {});
    } catch (e) {
        console.error("Erro ao reproduzir explosão:", e);
    }
}