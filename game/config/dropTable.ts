export interface DropEntry {
    itemId: string;
    weight: number;
}

export const DROP_CHANCE = 0.4;

export const DROP_TABLE: DropEntry[] = [
    { itemId: 'sword_common',  weight: 35 },
    { itemId: 'shield_common', weight: 35 },
    { itemId: 'sword_rare',    weight: 12 },
    { itemId: 'shield_rare',   weight: 13 },
    { itemId: 'sword_epic',    weight: 2 },
    { itemId: 'shield_epic',   weight: 3 },
];

export function rollDrop(): string | null {
    if (Math.random() > DROP_CHANCE) return null;

    const totalWeight = DROP_TABLE.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const entry of DROP_TABLE) {
        roll -= entry.weight;
        if (roll <= 0) return entry.itemId;
    }

    return DROP_TABLE[0].itemId;
}
