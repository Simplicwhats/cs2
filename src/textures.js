export function createWallTexture(baseColor, gridColor = "rgba(0,0,0,0.4)", pattern = 'grid') {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = baseColor; ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 6000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
    }

    ctx.lineWidth = 4;
    if (pattern === 'grid') {
        ctx.strokeStyle = gridColor;
        for(let i = 0; i <= 512; i += 64) {
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
        }
    } else if (pattern === 'brick') {
        const bh = 32, bw = 64;
        ctx.strokeStyle = gridColor;
        let row = 0;
        for (let y = 0; y < 512; y += bh) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
            let offset = (row % 2) * (bw / 2);
            for (let x = offset; x < 512; x += bw) {
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + bh); ctx.stroke();
            }
            row++;
        }
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 2;
        for (let y = 0; y < 512; y += bh) {
            ctx.beginPath(); ctx.moveTo(0, y+3); ctx.lineTo(512, y+3); ctx.stroke();
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; 
    tex.repeat.set(3, 3);
    return tex;
}