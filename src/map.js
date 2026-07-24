export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];

function createWallTexture(baseColor, gridColor = "rgba(0,0,0,0.18)", pattern = 'grid') {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = baseColor; ctx.fillRect(0, 0, 512, 512);
    
    ctx.strokeStyle = gridColor; 
    ctx.lineWidth = 4;

    if (pattern === 'grid') {
        for(let i = 0; i <= 512; i += 64) {
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
        }
    } else if (pattern === 'brick') {
        const bh = 32, bw = 64;
        let row = 0;
        for (let y = 0; y < 512; y += bh) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
            let offset = (row % 2) * (bw / 2);
            for (let x = offset; x < 512; x += bw) {
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + bh); ctx.stroke();
            }
            row++;
        }
    }

    // Ruído/Sujeira tática no piso/parede
    for (let i = 0; i < 2500; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; 
    tex.repeat.set(3, 3);
    return tex;
}

function createBlock(scene, x, y, z, w, h, d, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    
    const box = new THREE.Box3().setFromObject(mesh);
    box.userData = { mesh: mesh };
    collidables.push(box); 
    wallMeshes.push(mesh); 
    mapWallMeshes.push(mesh);
    return mesh;
}

function createFunctionalBuilding(scene, x, z, width, depth, height, mat, trimMat, winMat, addBalcony = true) {
    const wallT = 0.8;
    const floorH = 6.0; 
    const doorWidth = 5.0;

    // Paredes Principais
    createBlock(scene, x, height/2, z - depth/2, width, height, wallT, mat);
    createBlock(scene, x - width/2, height/2, z, wallT, height, depth, mat);
    createBlock(scene, x + width/2, height/2, z, wallT, height, depth, mat);

    // Fachada Frontal com Entrada
    const sideWallW = (width - doorWidth) / 2;
    createBlock(scene, x - width/2 + sideWallW/2, floorH/2, z + depth/2, sideWallW, floorH, wallT, mat);
    createBlock(scene, x + width/2 - sideWallW/2, floorH/2, z + depth/2, sideWallW, floorH, wallT, mat);
    createBlock(scene, x, floorH + (height - floorH)/2, z + depth/2, width, height - floorH, wallT, mat);

    // Moldura Teto
    createBlock(scene, x, height + 0.4, z, width + 0.6, 0.8, depth + 0.6, trimMat);

    // Laje do 2º Andar sem vãos vagos nas bordas
    const innerW = width - wallT * 2;
    const innerD = depth - wallT * 2;
    const holeSizeX = 4.5;
    const holeSizeZ = 7.0;

    // Placa de Piso 1 (Lado Maior)
    const floorTile1 = createBlock(scene, x - holeSizeX/2, floorH, z, innerW - holeSizeX, 0.4, innerD, mat);
    // Placa de Piso 2 (Entorno do buraco da escada)
    const floorTile2 = createBlock(scene, x + (innerW - holeSizeX)/2 - 0.2, floorH, z - holeSizeZ/2, holeSizeX, 0.4, innerD - holeSizeZ, mat);

    // Rampa / Escada Acoplada Perfeitamente ao Piso Superior
    const rampLength = 9.5;
    const rampWidth = holeSizeX - 0.2;
    const rampGeo = new THREE.BoxGeometry(rampWidth, 0.3, rampLength);
    const ramp = new THREE.Mesh(rampGeo, trimMat);
    
    const angle = Math.atan2(floorH, rampLength - 1.0);
    ramp.position.set(x + innerW/2 - rampWidth/2 - 0.2, floorH / 2, z + innerD/2 - rampLength/2);
    ramp.rotation.x = -angle;
    ramp.receiveShadow = true; ramp.castShadow = true;
    ramp.userData.isRamp = true; 
    scene.add(ramp);
    wallMeshes.push(ramp); mapWallMeshes.push(ramp);

    // Varanda Perfeitamente Acoplada
    if (addBalcony) {
        const balcDepth = 3.5;
        const balcWidth = width * 0.7;
        const balconyFloor = createBlock(scene, x, floorH, z + depth/2 + balcDepth/2 - 0.2, balcWidth, 0.4, balcDepth, mat);

        // Guardas da Varanda
        createBlock(scene, x, floorH + 0.6, z + depth/2 + balcDepth, balcWidth, 1.0, 0.3, trimMat);
        createBlock(scene, x - balcWidth/2, floorH + 0.6, z + depth/2 + balcDepth/2, 0.3, 1.0, balcDepth, trimMat);
        createBlock(scene, x + balcWidth/2, floorH + 0.6, z + depth/2 + balcDepth/2, 0.3, 1.0, balcDepth, trimMat);
    }
}

export function buildMapGeometries(scene, selectedMap) {
    collidables.length = 0; 
    wallMeshes.length = 0; 
    mapWallMeshes.length = 0;
    
    let fColor = 0xb59268, wColor = '#c2a882', bColor = '#8a6543', trimColor = '#5c4128', winColor = '#3a2717';
    
    if (selectedMap === 'mirage') {
        fColor = 0x8c7c68; wColor = '#b8a68d'; bColor = '#4a607a'; trimColor = '#2b3a4a'; winColor = '#1f2833';
    } else if (selectedMap === 'inferno') {
        fColor = 0x474747; wColor = '#8a3c2c'; bColor = '#5e7363'; trimColor = '#3a2118'; winColor = '#24140e';
    } else if (selectedMap === 'nuke') {
        fColor = 0x22272c; wColor = '#5a6978'; bColor = '#2d5573'; trimColor = '#1a2228'; winColor = '#0f171e';
    }

    const hexFloor = '#' + fColor.toString(16).padStart(6, '0');
    const fMat = new THREE.MeshStandardMaterial({ map: createWallTexture(hexFloor, "rgba(0,0,0,0.12)", 'grid'), roughness: 0.7 });
    const wMat = new THREE.MeshStandardMaterial({ map: createWallTexture(wColor, "rgba(0,0,0,0.2)", 'brick'), roughness: 0.6 });
    const bMat = new THREE.MeshStandardMaterial({ map: createWallTexture(bColor, "rgba(0,0,0,0.22)", 'grid'), roughness: 0.6 });
    const trimMat = new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.4, metalness: 0.2 });
    const winMat = new THREE.MeshStandardMaterial({ color: winColor, metalness: 0.8, roughness: 0.2 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), fMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    // Muros Perimetrais
    createBlock(scene, 0, 10, -160, 320, 20, 4, wMat); 
    createBlock(scene, 0, 10, 160, 320, 20, 4, wMat);
    createBlock(scene, -160, 10, 0, 4, 20, 320, wMat); 
    createBlock(scene, 160, 10, 0, 4, 20, 320, wMat);

    const cityLayout = [
        {x: -60, z: 60, w: 26, d: 26, h: 16, mat: wMat, hasBalcony: true},
        {x: 60, z: 60, w: 26, d: 26, h: 16, mat: bMat, hasBalcony: true},
        {x: -60, z: -60, w: 26, d: 26, h: 16, mat: bMat, hasBalcony: true},
        {x: 60, z: -60, w: 26, d: 26, h: 16, mat: wMat, hasBalcony: true},
        {x: 0, z: 70, w: 24, d: 20, h: 14, mat: bMat, hasBalcony: true},
        {x: 0, z: -70, w: 24, d: 20, h: 14, mat: wMat, hasBalcony: true},
        {x: -70, z: 0, w: 20, d: 24, h: 14, mat: wMat, hasBalcony: false},
        {x: 70, z: 0, w: 20, d: 24, h: 14, mat: bMat, hasBalcony: false}
    ];

    cityLayout.forEach(b => {
        createFunctionalBuilding(scene, b.x, b.z, b.w, b.d, b.h, b.mat, trimMat, winMat, b.hasBalcony);
    });

    // Caixas Operacionais táticas estilo Dust2
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7 });
    createBlock(scene, 15, 1.8, 15, 3.6, 3.6, 3.6, boxMat);
    createBlock(scene, -20, 1.8, 30, 4.0, 3.6, 4.0, boxMat);
    createBlock(scene, 0, 1.8, -40, 5.0, 3.6, 3.6, boxMat);
}