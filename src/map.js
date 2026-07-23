export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];

function createWallTexture(baseColor, gridColor = "rgba(0,0,0,0.25)", pattern = 'grid') {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = baseColor; ctx.fillRect(0, 0, 512, 512);
    
    ctx.strokeStyle = gridColor; 
    ctx.lineWidth = 3;

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

    for (let i = 0; i < 1500; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)";
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; 
    tex.repeat.set(2, 2);
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
}

function createFunctionalBuilding(scene, x, z, width, depth, height, mat, trimMat, winMat, addBalcony = true) {
    const wallT = 1.2;
    const floorH = 8.0; 
    const doorWidth = 6.0;

    createBlock(scene, x, height/2, z - depth/2, width, height, wallT, mat);
    createBlock(scene, x - width/2, height/2, z, wallT, height, depth, mat);
    createBlock(scene, x + width/2, height/2, z, wallT, height, depth, mat);

    const sideWallW = (width - doorWidth) / 2;
    createBlock(scene, x - width/2 + sideWallW/2, floorH/2, z + depth/2, sideWallW, floorH, wallT, mat);
    createBlock(scene, x + width/2 - sideWallW/2, floorH/2, z + depth/2, sideWallW, floorH, wallT, mat);

    if (addBalcony) {
        const upperWallH = height - floorH;
        createBlock(scene, x - width/2 + sideWallW/2, floorH + upperWallH/2, z + depth/2, sideWallW, upperWallH, wallT, mat);
        createBlock(scene, x + width/2 - sideWallW/2, floorH + upperWallH/2, z + depth/2, sideWallW, upperWallH, wallT, mat);
    } else {
        createBlock(scene, x, floorH + (height - floorH)/2, z + depth/2, width, height - floorH, wallT, mat);
    }

    const winGeo = new THREE.BoxGeometry(0.2, 2.5, 2.0);
    const winLeft = new THREE.Mesh(winGeo, winMat);
    winLeft.position.set(x - width/2 - 0.1, floorH + 2, z);
    scene.add(winLeft);

    const winRight = new THREE.Mesh(winGeo, winMat);
    winRight.position.set(x + width/2 + 0.1, floorH + 2, z);
    scene.add(winRight);

    createBlock(scene, x, height + 0.5, z, width + 0.5, 1.0, depth + 0.5, trimMat);

    const stairHoleDepth = 18.0; 
    const stairHoleWidth = 8.0; 

    const mainFloorDepth = depth - stairHoleDepth - 2;
    const floorTile1 = new THREE.Mesh(new THREE.BoxGeometry(width - 2, 0.6, mainFloorDepth), mat);
    floorTile1.position.set(x, floorH, z + (stairHoleDepth / 2));
    floorTile1.receiveShadow = true; floorTile1.castShadow = true;
    scene.add(floorTile1);
    collidables.push(new THREE.Box3().setFromObject(floorTile1));
    wallMeshes.push(floorTile1); mapWallMeshes.push(floorTile1);

    const sideFloorWidth = (width - 2) - stairHoleWidth;
    if (sideFloorWidth > 0) {
        const floorTile2 = new THREE.Mesh(new THREE.BoxGeometry(sideFloorWidth, 0.6, stairHoleDepth), mat);
        floorTile2.position.set(x - (stairHoleWidth / 2), floorH, z - (depth / 2) + (stairHoleDepth / 2) + 1);
        floorTile2.receiveShadow = true; floorTile2.castShadow = true;
        scene.add(floorTile2);
        collidables.push(new THREE.Box3().setFromObject(floorTile2));
        wallMeshes.push(floorTile2); mapWallMeshes.push(floorTile2);
    }

    const rampLength = 16; 
    const rampWidth = 6.0;
    const rampGeo = new THREE.BoxGeometry(rampWidth, 0.4, rampLength);
    const ramp = new THREE.Mesh(rampGeo, trimMat);
    
    const angle = Math.atan2(floorH, rampLength - 3);
    ramp.position.set(x + (width / 2) - (rampWidth / 2) - 2, (floorH / 2) - 0.2, z - (depth / 2) + (rampLength / 2) + 2);
    ramp.rotation.x = -angle;
    
    ramp.receiveShadow = true; ramp.castShadow = true;
    ramp.userData.isRamp = true; 
    scene.add(ramp);
    wallMeshes.push(ramp); mapWallMeshes.push(ramp);

    if (addBalcony) {
        const balcDepth = 4.5;
        const balconyFloor = new THREE.Mesh(new THREE.BoxGeometry(width * 0.6, 0.5, balcDepth), mat);
        balconyFloor.position.set(x, floorH, z + depth/2 + balcDepth/2);
        balconyFloor.receiveShadow = true; balconyFloor.castShadow = true;
        scene.add(balconyFloor);
        collidables.push(new THREE.Box3().setFromObject(balconyFloor));
        wallMeshes.push(balconyFloor); mapWallMeshes.push(balconyFloor);

        createBlock(scene, x, floorH + 0.8, z + depth/2 + balcDepth, width * 0.6, 1.2, 0.4, trimMat);
        createBlock(scene, x - (width * 0.3), floorH + 0.8, z + depth/2 + balcDepth/2, 0.4, 1.2, balcDepth, trimMat);
        createBlock(scene, x + (width * 0.3), floorH + 0.8, z + depth/2 + balcDepth/2, 0.4, 1.2, balcDepth, trimMat);
    }
}

export function buildMapGeometries(scene, selectedMap) {
    collidables.length = 0; 
    wallMeshes.length = 0; 
    mapWallMeshes.length = 0;
    
    let fColor, wColor, bColor, trimColor, winColor;
    
    if (selectedMap === 'dust2') {
        fColor = 0xb59268; wColor = '#c2a882'; bColor = '#8a6543'; trimColor = '#5c4128'; winColor = '#3a2717';
    } else if (selectedMap === 'mirage') {
        fColor = 0x8c7c68; wColor = '#b8a68d'; bColor = '#4a607a'; trimColor = '#2b3a4a'; winColor = '#1f2833';
    } else if (selectedMap === 'inferno') {
        fColor = 0x474747; wColor = '#8a3c2c'; bColor = '#5e7363'; trimColor = '#3a2118'; winColor = '#24140e';
    } else { 
        fColor = 0x22272c; wColor = '#5a6978'; bColor = '#2d5573'; trimColor = '#1a2228'; winColor = '#0f171e';
    }

    const hexFloor = '#' + fColor.toString(16).padStart(6, '0');
    const fMat = new THREE.MeshStandardMaterial({ map: createWallTexture(hexFloor, "rgba(0,0,0,0.15)", 'grid'), roughness: 0.8 });
    const wMat = new THREE.MeshStandardMaterial({ map: createWallTexture(wColor, "rgba(0,0,0,0.2)", 'brick'), roughness: 0.7 });
    const bMat = new THREE.MeshStandardMaterial({ map: createWallTexture(bColor, "rgba(0,0,0,0.25)", 'grid'), roughness: 0.7 });
    const trimMat = new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.5 });
    const winMat = new THREE.MeshStandardMaterial({ color: winColor, metalness: 0.8, roughness: 0.2 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), fMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    createBlock(scene, 0, 12, -160, 320, 24, 4, wMat); 
    createBlock(scene, 0, 12, 160, 320, 24, 4, wMat);
    createBlock(scene, -160, 12, 0, 4, 24, 320, wMat); 
    createBlock(scene, 160, 12, 0, 4, 24, 320, wMat);

    const cityLayout = [
        {x: -65, z: 65, w: 32, d: 32, h: 22, mat: wMat, hasBalcony: true},
        {x: 65, z: 65, w: 32, d: 32, h: 22, mat: bMat, hasBalcony: true},
        {x: -65, z: -65, w: 32, d: 32, h: 22, mat: bMat, hasBalcony: true},
        {x: 65, z: -65, w: 32, d: 32, h: 22, mat: wMat, hasBalcony: true},
        {x: 0, z: 75, w: 26, d: 20, h: 18, mat: bMat, hasBalcony: true},
        {x: 0, z: -75, w: 26, d: 20, h: 18, mat: wMat, hasBalcony: true},
        {x: -75, z: 0, w: 20, d: 26, h: 18, mat: wMat, hasBalcony: false},
        {x: 75, z: 0, w: 20, d: 26, h: 18, mat: bMat, hasBalcony: false},
        {x: -25, z: -25, w: 22, d: 22, h: 20, mat: wMat, hasBalcony: true},
        {x: 25, z: 25, w: 22, d: 22, h: 20, mat: bMat, hasBalcony: true}
    ];

    cityLayout.forEach(b => {
        createFunctionalBuilding(scene, b.x, b.z, b.w, b.d, b.h, b.mat, trimMat, winMat, b.hasBalcony);
    });

    if (selectedMap === 'dust2') {
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
        createBlock(scene, 15, 2, 15, 4, 4, 4, boxMat);
        createBlock(scene, -20, 2, 30, 5, 4, 5, boxMat);
        createBlock(scene, 0, 2, -40, 6, 4, 4, boxMat);
    }
}