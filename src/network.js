export let peer = null;
export let hostConns = [];
export let myConn = null;

export function initHost(maxClients, updateLobbyStatus, handleData, playerScores, updateScoreboard) {
    const room = Math.random().toString(36).substring(2, 8);
    peer = new Peer(room, { host: '0.peerjs.com', port: 443, path: '/', secure: true });

    peer.on('open', () => {
        document.getElementById('lobby-link').value = `${window.location.href.split('?')[0]}?room=${room}`;
    });

    peer.on('connection', (c) => {
        if (hostConns.length >= maxClients) { c.close(); return; }
        hostConns.push(c);
        c.on('data', (d) => handleData(c.peer, d));
        c.on('open', () => { updateLobbyStatus(); });
        c.on('close', () => {
            hostConns = hostConns.filter(conn => conn !== c);
            delete playerScores[c.peer];
            updateLobbyStatus();
            updateScoreboard();
        });
    });
}

export function initClient(targetRoom, handleData) {
    peer = new Peer({ host: '0.peerjs.com', port: 443, path: '/', secure: true });
    peer.on('open', () => {
        myConn = peer.connect(targetRoom);
        myConn.on('open', () => {
            const label = document.getElementById('net-status-label');
            label.innerText = "Conectado com sucesso!";
            label.style.color = "#00ff88";
        });
        myConn.on('data', (d) => handleData('host', d));
    });
}

export function broadcastData(isHost, data, excludePeer = null) {
    if (isHost) {
        hostConns.forEach(c => { if (c.peer !== excludePeer) c.send(data); });
    } else if (myConn) {
        myConn.send(data);
    }
}

export function createNetworkPlayer(scene, networkPlayers, playerScores, wallMeshes, id, nick) {
    if (networkPlayers[id]) return;
    const group = new THREE.Group();

    const matUniform = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.6 });
    const matVest = new THREE.MeshStandardMaterial({ color: 0x1a252f, roughness: 0.4 });
    const matSkin = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.7 });
    const matHelmet = new THREE.MeshStandardMaterial({ color: 0x34495e, metalness: 0.4, roughness: 0.3 });
    const matGun = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });

    const torsoGeo = new THREE.BoxGeometry(0.5, 0.75, 0.3);
    const torso = new THREE.Mesh(torsoGeo, matUniform); torso.position.set(0, 1.25, 0);

    const headGeo = new THREE.BoxGeometry(0.28, 0.32, 0.28);
    const head = new THREE.Mesh(headGeo, matSkin); head.position.set(0, 1.82, 0);

    const helmetGeo = new THREE.BoxGeometry(0.32, 0.18, 0.32);
    const helmet = new THREE.Mesh(helmetGeo, matHelmet); helmet.position.set(0, 1.93, 0);

    const rifleGeo = new THREE.BoxGeometry(0.1, 0.12, 0.7);
    const rifle = new THREE.Mesh(rifleGeo, matGun); rifle.position.set(0.2, 1.05, -0.25);

    group.add(torso, head, helmet, rifle);

    const hitboxBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 1.9, 12),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    hitboxBody.position.y = 0.95;
    group.add(hitboxBody);

    scene.add(group);
    wallMeshes.push(hitboxBody);
    networkPlayers[id] = group;
    if (!playerScores[id]) playerScores[id] = 0;
}