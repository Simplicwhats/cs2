export const itemsConfig = {
    deagle: { name: "Desert Eagle", damage: 60, fireRate: 350, maxAmmo: 7, totalAmmo: 35, spread: 0.008, recoil: 0.015, price: 700, auto: false, slot: 'secondary' },
    p90:    { name: "P90", damage: 22, fireRate: 80, maxAmmo: 50, totalAmmo: 100, spread: 0.012, recoil: 0.005, price: 2350, auto: true, slot: 'primary' },
    ak47:   { name: "AK-47", damage: 36, fireRate: 110, maxAmmo: 30, totalAmmo: 90, spread: 0.008, recoil: 0.010, price: 2700, auto: true, slot: 'primary' },
    m4a4:   { name: "M4A4", damage: 28, fireRate: 95, maxAmmo: 30, totalAmmo: 90, spread: 0.006, recoil: 0.007, price: 3100, auto: true, slot: 'primary' },
    awp:    { name: "AWP", damage: 115, fireRate: 1300, maxAmmo: 5, totalAmmo: 30, spread: 0.001, recoil: 0.030, price: 4750, zoomFov: 20, auto: false, slot: 'primary' },
    armor:  { name: "Colete Balístico", price: 650, type: 'gear' },
    helmet: { name: "Capacete", price: 350, type: 'gear' },
    grenade:{ name: "Granada HE", price: 300, type: 'gear', maxAmmo: 1 }
};

export const safeSpawns = [
    {x: 0, z: 0}, {x: 40, z: 20}, {x: -40, z: -20}, {x: 20, z: -40}, {x: -20, z: 40},
    {x: 80, z: 15}, {x: -80, z: -15}, {x: 15, z: -80}, {x: -15, z: 80},
    {x: 100, z: 100}, {x: -100, z: -100}, {x: 100, z: -100}, {x: -100, z: 100}
];