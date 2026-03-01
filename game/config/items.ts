export type ItemType = 'weapon' | 'armor';
export type ItemRarity = 'common' | 'rare' | 'epic';

export interface ItemDef {
    id: string;
    name: string;
    type: ItemType;
    rarity: ItemRarity;
    color: number;
    atkBonus: number;
    hpBonus: number;
    isExportable?: boolean;
}

export const EQUIP_SLOTS = [
    { id: 'weapon', label: '무기', type: 'weapon' as ItemType },
    { id: 'armor', label: '방어구', type: 'armor' as ItemType },
] as const;

export const ITEM_DEFS: Record<string, ItemDef> = {
    sword_common: { id: 'sword_common', name: '낡은 검', type: 'weapon', rarity: 'common', color: 0xcccccc, atkBonus: 5, hpBonus: 0 },
    sword_rare: { id: 'sword_rare', name: '강철 검', type: 'weapon', rarity: 'rare', color: 0x4488ff, atkBonus: 10, hpBonus: 0 },
    sword_epic: { id: 'sword_epic', name: '영웅의 검', type: 'weapon', rarity: 'epic', color: 0xaa44ff, atkBonus: 20, hpBonus: 0, isExportable: true },
    shield_common: { id: 'shield_common', name: '나무 방패', type: 'armor', rarity: 'common', color: 0xcccccc, atkBonus: 0, hpBonus: 20 },
    shield_rare: { id: 'shield_rare', name: '강철 갑옷', type: 'armor', rarity: 'rare', color: 0x4488ff, atkBonus: 0, hpBonus: 50 },
    shield_epic: { id: 'shield_epic', name: '영웅의 갑옷', type: 'armor', rarity: 'epic', color: 0xaa44ff, atkBonus: 0, hpBonus: 100, isExportable: true },
};

export const RARITY_COLORS: Record<ItemRarity, number> = {
    common: 0xcccccc,
    rare: 0x4488ff,
    epic: 0xaa44ff,
};
