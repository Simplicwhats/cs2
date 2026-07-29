// src/bot.js
export class Bot {
    constructor(scene, position) {
        this.scene = scene;
        this.mesh = null;
        this.health = 100;
        this.init(position);
    }
    init(position) {
        // Lógica futura de IA
    }
    update(player) {
        // Lógica de perseguição e tiro
    }
}