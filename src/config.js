export const itemsConfig = {
    deagle: { name: "Desert Eagle", damage: 62, fireRate: 320, maxAmmo: 7, totalAmmo: 35, spread: 0.006, recoil: 0.035, price: 700, auto: false, slot: 'secondary' },
    p90:    { name: "P90", damage: 24, fireRate: 75, maxAmmo: 50, totalAmmo: 100, spread: 0.010, recoil: 0.012, price: 2350, auto: true, slot: 'primary' },
    ak47:   { name: "AK-47", damage: 38, fireRate: 100, maxAmmo: 30, totalAmmo: 90, spread: 0.005, recoil: 0.024, price: 2700, auto: true, slot: 'primary' },
    m4a4:   { name: "M4A4", damage: 30, fireRate: 90, maxAmmo: 30, totalAmmo: 90, spread: 0.004, recoil: 0.018, price: 3100, auto: true, slot: 'primary' },
    awp:    { name: "AWP", damage: 120, fireRate: 1250, maxAmmo: 5, totalAmmo: 30, spread: 0.0005, recoil: 0.060, price: 4750, zoomFov: 25, auto: false, slot: 'primary' },
    grenade:{ name: "Granada HE", price: 300, type: 'gear', maxAmmo: 1, slot: 'grenade', damage: 95, radius: 14 },
    armor:  { name: "Colete Balístico", price: 650, type: 'gear' },
    helmet: { name: "Capacete", price: 350, type: 'gear' }
};

export const safeSpawns = [
    {x: 0, z: 0}, {x: 40, z: 20}, {x: -40, z: -20}, {x: 20, z: -40}, {x: -20, z: 40},
    {x: 80, z: 15}, {x: -80, z: -15}, {x: 15, z: -80}, {x: -15, z: 80},
    {x: 100, z: 100}, {x: -100, z: -100}, {x: 100, z: -100}, {x: -100, z: 100}
];