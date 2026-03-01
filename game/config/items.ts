export type EquipSlotId = 'Head' | 'Body' | 'Legs' | 'Shoes' | 'RightHand' | 'LeftHand';
export type WeaponType = 'Sword' | 'Spear'; // Shield 제외 — 방패는 방어구 취급
export type ItemRarity = 'common' | 'rare' | 'epic';

export interface ItemDef {
    id: string;
    name: string;
    rarity: ItemRarity;
    slot: EquipSlotId;
    weaponType?: WeaponType;   // RightHand/LeftHand 슬롯 무기만 (Sword, Spear)
    isTwoHanded?: boolean;     // Spear: true → RightHand + LeftHand 동시 점유
    color: number;
    atkBonus: number;
    defBonus: number;
    hpBonus: number;
    speedBonus: number;
    isExportable?: boolean;
}

export const EQUIP_SLOTS: readonly { id: EquipSlotId; label: string }[] = [
    { id: 'Head',      label: '머리' },
    { id: 'Body',      label: '몸통' },
    { id: 'Legs',      label: '다리' },
    { id: 'Shoes',     label: '신발' },
    { id: 'RightHand', label: '오른손' },
    { id: 'LeftHand',  label: '왼손' },
] as const;

export const ITEM_DEFS: Record<string, ItemDef> = {
    // ── RightHand: Sword ──────────────────────────────────
    sword_common: {
        id: 'sword_common', name: '낡은 검', rarity: 'common',
        slot: 'RightHand', weaponType: 'Sword',
        color: 0xcccccc, atkBonus: 5, defBonus: 0, hpBonus: 0, speedBonus: 0,
    },
    sword_rare: {
        id: 'sword_rare', name: '강철 검', rarity: 'rare',
        slot: 'RightHand', weaponType: 'Sword',
        color: 0x4488ff, atkBonus: 12, defBonus: 0, hpBonus: 0, speedBonus: 0,
    },
    sword_epic: {
        id: 'sword_epic', name: '영웅의 검', rarity: 'epic',
        slot: 'RightHand', weaponType: 'Sword',
        color: 0xaa44ff, atkBonus: 25, defBonus: 0, hpBonus: 0, speedBonus: 0,
        isExportable: true,
    },

    // ── RightHand: Spear (양손) ───────────────────────────
    spear_common: {
        id: 'spear_common', name: '나무 창', rarity: 'common',
        slot: 'RightHand', weaponType: 'Spear', isTwoHanded: true,
        color: 0xaa8844, atkBonus: 8, defBonus: 0, hpBonus: 0, speedBonus: 0,
    },
    spear_rare: {
        id: 'spear_rare', name: '강철 창', rarity: 'rare',
        slot: 'RightHand', weaponType: 'Spear', isTwoHanded: true,
        color: 0x44aaff, atkBonus: 18, defBonus: 0, hpBonus: 0, speedBonus: 0,
    },

    // ── LeftHand: Sword (쌍검용 보조검) ──────────────────
    offhand_sword_common: {
        id: 'offhand_sword_common', name: '단검', rarity: 'common',
        slot: 'LeftHand', weaponType: 'Sword',
        color: 0xbbbbbb, atkBonus: 4, defBonus: 0, hpBonus: 0, speedBonus: 0,
    },
    offhand_sword_rare: {
        id: 'offhand_sword_rare', name: '은검', rarity: 'rare',
        slot: 'LeftHand', weaponType: 'Sword',
        color: 0x88aaff, atkBonus: 9, defBonus: 0, hpBonus: 0, speedBonus: 0,
    },

    // ── LeftHand: Shield (방어구 취급, weaponType 없음) ───
    shield_common: {
        id: 'shield_common', name: '나무 방패', rarity: 'common',
        slot: 'LeftHand',
        color: 0xcc9955, atkBonus: 0, defBonus: 5, hpBonus: 10, speedBonus: 0,
    },
    shield_rare: {
        id: 'shield_rare', name: '강철 방패', rarity: 'rare',
        slot: 'LeftHand',
        color: 0x4488ff, atkBonus: 0, defBonus: 10, hpBonus: 25, speedBonus: 0,
    },
    shield_epic: {
        id: 'shield_epic', name: '영웅의 방패', rarity: 'epic',
        slot: 'LeftHand',
        color: 0xaa44ff, atkBonus: 0, defBonus: 18, hpBonus: 50, speedBonus: 0,
        isExportable: true,
    },

    // ── Head ──────────────────────────────────────────────
    helm_common: {
        id: 'helm_common', name: '가죽 투구', rarity: 'common',
        slot: 'Head',
        color: 0x996633, atkBonus: 0, defBonus: 3, hpBonus: 10, speedBonus: 0,
    },
    helm_rare: {
        id: 'helm_rare', name: '강철 투구', rarity: 'rare',
        slot: 'Head',
        color: 0x4466aa, atkBonus: 0, defBonus: 7, hpBonus: 20, speedBonus: 0,
    },

    // ── Body ──────────────────────────────────────────────
    body_common: {
        id: 'body_common', name: '가죽 갑옷', rarity: 'common',
        slot: 'Body',
        color: 0x886622, atkBonus: 0, defBonus: 4, hpBonus: 20, speedBonus: 0,
    },
    body_rare: {
        id: 'body_rare', name: '체인 갑옷', rarity: 'rare',
        slot: 'Body',
        color: 0x4477bb, atkBonus: 0, defBonus: 8, hpBonus: 40, speedBonus: 0,
    },
    body_epic: {
        id: 'body_epic', name: '용사의 갑옷', rarity: 'epic',
        slot: 'Body',
        color: 0xaa44ff, atkBonus: 0, defBonus: 15, hpBonus: 80, speedBonus: 0,
        isExportable: true,
    },

    // ── Legs ──────────────────────────────────────────────
    legs_common: {
        id: 'legs_common', name: '가죽 각반', rarity: 'common',
        slot: 'Legs',
        color: 0x775522, atkBonus: 0, defBonus: 3, hpBonus: 10, speedBonus: 0,
    },

    // ── Shoes ─────────────────────────────────────────────
    boots_common: {
        id: 'boots_common', name: '가죽 장화', rarity: 'common',
        slot: 'Shoes',
        color: 0x664411, atkBonus: 0, defBonus: 1, hpBonus: 0, speedBonus: 15,
    },
    boots_rare: {
        id: 'boots_rare', name: '질풍 장화', rarity: 'rare',
        slot: 'Shoes',
        color: 0x44aacc, atkBonus: 0, defBonus: 2, hpBonus: 0, speedBonus: 30,
    },
};

export const RARITY_COLORS: Record<ItemRarity, number> = {
    common: 0xcccccc,
    rare: 0x4488ff,
    epic: 0xaa44ff,
};
