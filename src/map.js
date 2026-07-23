import { createWallTexture } from './textures.js';

export let collidables = [];
export let wallMeshes = [];
export let mapWallMeshes = [];

export function clearMapData() {
    collidables.length = 0;
    wallMeshes.length = 0;
    mapWallMeshes.length = 0;
}

export function buildMapGeometries(scene, selectedMap) {
    clearMapData();
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

    const fMat = new THREE.MeshStandardMaterial({ map: createWallTexture('#' + fColor.toString(16), "rgba(0,0,0,0.15)", 'grid'), roughness: 0.8 });
    const wMat = new THREE.MeshStandardMaterial({ map: createWallTexture(wColor, "rgba(0,0,0,0.3)", 'brick'), roughness: 0.7 });
    const bMat = new THREE.MeshStandardMaterial({ map: createWallTexture(bColor, "rgba(0,0,0,0.35)", 'grid'), roughness: 0.7 });
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
}

export function createBlock(scene, x, y, z, w, h, d, mat) {
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
    const wallT = 1.2; const floorH = 8.0; const doorWidth = 6.0;

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

    const stairHoleDepth = 18.0; const stairHoleWidth = 8.0; 
    const mainFloorDepth = depth - stairHoleDepth - 1; 
    const floorTile1 = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.6, mainFloorDepth), mat); 
    floorTile1.position.set(x, floorH, z + (stairHoleDepth / 2));
    floorTile1.receiveShadow = true; floorTile1.castShadow = true;
    scene.add(floorTile1);
    collidables.push(new THREE.Box3().setFromObject(floorTile1));
    wallMeshes.push(floorTile1); mapWallMeshes.push(floorTile1);

    const rampLength = 19; const rampWidth = 6.0;
    const rampGeo = new THREE.BoxGeometry(rampWidth, 0.4, rampLength);
    const ramp = new THREE.Mesh(rampGeo, trimMat);
    
    const angle = Math.atan2(floorH, rampLength - 1.5);
    ramp.position.set(x + (width / 2) - (rampWidth / 2) - 1.8, (floorH / 2) - 0.1, z - (depth / 2) + (rampLength / 2) + 1.2);
    ramp.rotation.x = -angle;
    
    ramp.receiveShadow = true; ramp.castShadow = true;
    ramp.userData.isRamp = true; 
    scene.add(ramp);
    wallMeshes.push(ramp); mapWallMeshes.push(ramp);

    if (addBalcony) {
        const balcDepth = 4.5;
        const balconyFloor = new THREE.Mesh(new THREE.BoxGeometry(width * 0.6, 0.5, balcDepth + 1.2), mat);
        balconyFloor.position.set(x, floorH, z + depth/2 + balcDepth/2 - 0.6);
        balconyFloor.receiveShadow = true; balconyFloor.castShadow = true;
        scene.add(balconyFloor);
        collidables.push(new THREE.Box3().setFromObject(balconyFloor));
        wallMeshes.push(balconyFloor); mapWallMeshes.push(balconyFloor);

        createBlock(scene, x, floorH + 0.8, z + depth/2 + balcDepth, width * 0.6, 1.2, 0.4, trimMat);
        createBlock(scene, x - (width * 0.3), floorH + 0.8, z + depth/2 + balcDepth/2, 0.4, 1.2, balcDepth, trimMat);
        createBlock(scene, x + (width * 0.3), floorH + 0.8, z + depth/2 + balcDepth/2, 0.4, 1.2, balcDepth, trimMat);
    }
}