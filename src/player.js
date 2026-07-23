import { itemsConfig } from './config.js';
import { playReloadSound } from './audio.js';

export function buyWeapon(key, playerMoney, inventory, activeSlot, hasArmor, hasHelmet, grenadesCount, build3DWeapon, updateHUD, toggleBuyMenu) {
    const item = itemsConfig[key];
    if (!item || playerMoney.value < item.price) return playerMoney.value;

    if (item.type === 'gear') {
        if (key === 'armor' && !hasArmor.value) {
            hasArmor.value = true; playerMoney.value -= item.price;
        } else if (key === 'helmet' && !hasHelmet.value) {
            hasHelmet.value = true; playerMoney.value -= item.price;
        } else if (key === 'grenade') {
            grenadesCount.value++; playerMoney.value -= item.price;
        }
    } else {
        playerMoney.value -= item.price;
        if (item.slot === 'secondary') {
            inventory.secondary = { key: key, ammo: item.maxAmmo, reserveAmmo: item.totalAmmo };
            activeSlot.value = 'secondary';
        } else {
            inventory.primary = { key: key, ammo: item.maxAmmo, reserveAmmo: item.totalAmmo };
            activeSlot.value = 'primary';
        }
        build3DWeapon();
    }
    updateHUD();
    toggleBuyMenu(false);
    return playerMoney.value;
}

export function reload(inventory, activeSlot, getCurrentWeaponKey, updateHUD) {
    const curInv = inventory[activeSlot.value];
    const cfg = itemsConfig[curInv.key || getCurrentWeaponKey()];
    if (curInv.ammo === cfg.maxAmmo) return;

    playReloadSound();
    document.getElementById('ammo').innerText = "--";
    setTimeout(() => {
        curInv.ammo = cfg.maxAmmo;
        updateHUD();
    }, 1500);
}

export function takeDamage(dmg, sourcePos, hp, isDead, isInvulnerable, hasArmor, hasHelmet, camera, updateHUD, restartRoundCallback) {
    if (isDead.value || isInvulnerable.value) return;

    let finalDmg = dmg;
    const isHeadshot = sourcePos && (sourcePos.y > camera.position.y + 0.2);

    if (isHeadshot) {
        if (hasHelmet.value) finalDmg *= 0.4;
    } else {
        if (hasArmor.value) finalDmg *= 0.65;
    }

    hp.value -= finalDmg;

    const overlay = document.getElementById('damage-overlay');
    overlay.style.boxShadow = "inset 0 0 200px rgba(255, 0, 0, 0.6)";
    setTimeout(() => overlay.style.boxShadow = "inset 0 0 150px rgba(255,0,0,0)", 150);

    if (hp.value <= 0) {
        hp.value = 0;
        isDead.value = true;
        const msg = document.getElementById('round-message');
        msg.innerText = "VOCÊ FOI ELIMINADO";
        msg.style.display = 'block';

        document.exitPointerLock();
        setTimeout(restartRoundCallback, 3000);
    }
    updateHUD();
}