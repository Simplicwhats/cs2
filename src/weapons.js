import { itemsConfig } from './config.js';
import { playShootSound, playExplosionSound } from './audio.js';
import { wallMeshes } from './map.js';

export let activeGrenades = [];
export let lastShotTime = 0;
export let recoilOffset = 0;

export function build3DWeapon(gunGroup, getCurrentWeaponKey) {
    while (gunGroup.children.length > 0) gunGroup.remove(gunGroup.children[0]);
    const mDark = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, metalness: 0.7, roughness: 0.4 });
    const mWood = new THREE.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.8 });
    let barrelOffsetZ = -0.45;
    const curKey = getCurrentWeaponKey();

    if (curKey === 'ak47') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.45), mDark);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.2), mWood); stock.position.set(0, -0.02, 0.3);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3), mDark); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.01, -0.45);
        gunGroup.add(body, stock, barrel);
    } else if (curKey === 'awp') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.6), new THREE.MeshStandardMaterial({ color: 0x243621 }));
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25), mDark); scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.07, -0.05);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5), mDark); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.55);
        barrelOffsetZ = -0.8;
        gunGroup.add(body, scope, barrel);
    } else if (curKey === 'p90') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.08, 0.35), mDark);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.2), mDark); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.01, -0.35);
        barrelOffsetZ = -0.45;
        gunGroup.add(body, barrel);
    } else {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.35), mDark);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2), mDark); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0, -0.27);
        barrelOffsetZ = -0.37;
        gunGroup.add(body, barrel);
    }

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.6 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 });
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.2), sleeveMat);
    arm.rotation.x = Math.PI / 2; arm.position.set(-0.03, -0.05, 0.1);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.03), skinMat);
    hand.position.set(-0.02, -0.01, -0.05);
    gunGroup.add(arm, hand);

    const muzzleFlashMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0, depthWrite: false }));
    muzzleFlashMesh.position.set(0, 0.01, barrelOffsetZ);
    const muzzleLight = new THREE.PointLight(0xffaa00, 0, 8);
    muzzleLight.position.set(0, 0, barrelOffsetZ);
    gunGroup.add(muzzleFlashMesh, muzzleLight);

    gunGroup.position.set(0.18, -0.22, -0.3);
    return { muzzleFlashMesh, muzzleLight };
}

export function createBulletTracer(scene, startPos, endPos) {
    const geometry = new THREE.BufferGeometry().setFromPoints([startPos, endPos]);
    const material = new THREE.LineBasicMaterial({ color: 0xffea55, linewidth: 2, transparent: true, opacity: 0.8 });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    setTimeout(() => scene.remove(line), 60);
}

export function shoot(scene, camera, gunGroup, muzzleFlashMesh, muzzleLight, inventory, activeSlot, getCurrentWeaponKey, cameraEuler, isAiming, velocity, gameMode, bots, networkPlayers, broadcastData, peer, isHost, playerScores, updateHUD, updateScoreboard, showKillFeed, takeDamage) {
    const now = performance.now();
    const curKey = getCurrentWeaponKey();
    const cfg = itemsConfig[curKey];
    if (now - lastShotTime < cfg.fireRate) return;

    lastShotTime = now;
    inventory[activeSlot].ammo--;
    updateHUD();
    playShootSound();

    gunGroup.position.z += 0.05;
    setTimeout(() => gunGroup.position.z -= 0.05, 50);
    muzzleFlashMesh.material.opacity = 0.8;
    muzzleFlashMesh.rotation.z = Math.random() * Math.PI;
    muzzleLight.intensity = 2.0;
    setTimeout(() => { muzzleFlashMesh.material.opacity = 0; muzzleLight.intensity = 0; }, 40);

    recoilOffset += cfg.recoil;
    cameraEuler.x += cfg.recoil;
    cameraEuler.y += (Math.random() - 0.5) * (cfg.recoil * 0.4);
    camera.quaternion.setFromEuler(cameraEuler);

    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    let spr = cfg.spread * (isAiming ? 0.3 : (Math.abs(velocity.x) > 1 ? 2.5 : 1.0));
    ray.ray.direction.x += (Math.random() - 0.5) * spr;
    ray.ray.direction.y += (Math.random() - 0.5) * spr;

    let endPoint = ray.ray.at(100, new THREE.Vector3());
    const hits = ray.intersectObjects(wallMeshes, true);
    let hitPlayer = false;

    if (hits.length > 0) {
        const hit = hits[0];
        endPoint.copy(hit.point);

        if (gameMode === 'bot') {
            for (let bot of bots) {
                if (hit.object.parent === bot.mesh || hit.object === bot.mesh) {
                    bot.hp -= cfg.damage;
                    hitPlayer = true;
                    if (bot.hp <= 0) {
                        const myId = isHost ? 'host' : peer.id;
                        playerScores[myId] = (playerScores[myId] || 0) + 1;
                        showKillFeed("+ $300 | +30 HP (Eliminação)");
                        bot.hp = 100;
                        bot.mesh.position.set((Math.random() - 0.5) * 50, 0.9, (Math.random() - 0.5) * 50);
                        if (updateScoreboard) updateScoreboard();
                    }
                    break;
                }
            }
        }
    }

    createBulletTracer(scene, camera.position, endPoint);
}

export function throwGrenade(scene, camera, grenadesCount, isDead, buyMenuOpen, updateHUD, bots, gameMode, isHost, peer, playerScores, updateScoreboard, showKillFeed) {
    if (grenadesCount.value <= 0 || isDead || buyMenuOpen) return;
    grenadesCount.value--;
    updateHUD();

    const gGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const gMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.4 });
    const gMesh = new THREE.Mesh(gGeo, gMat);
    gMesh.position.copy(camera.position);

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const velocity = camDir.clone().multiplyScalar(22).add(new THREE.Vector3(0, 6, 0));

    scene.add(gMesh);
    activeGrenades.push({
        mesh: gMesh,
        velocity: velocity,
        explosionTime: performance.now() + 2000
    });
}