export interface DropEntry {
    itemId: string;
    weight: number;
}

export const DROP_CHANCE = 0.10;

export const DROP_TABLE: DropEntry[] = [
    // RightHand weapons
    { itemId: 'sword_common',           weight: 20 },
    { itemId: 'sword_rare',             weight: 7  },
    { itemId: 'sword_epic',             weight: 2  },
    { itemId: 'spear_common',           weight: 10 },
    { itemId: 'spear_rare',             weight: 4  },
    // LeftHand weapons
    { itemId: 'offhand_sword_common',   weight: 8  },
    { itemId: 'offhand_sword_rare',     weight: 3  },
    // LeftHand shields
    { itemId: 'shield_common',          weight: 12 },
    { itemId: 'shield_rare',            weight: 5  },
    { itemId: 'shield_epic',            weight: 2  },
    // Head
    { itemId: 'helm_common',            weight: 8  },
    { itemId: 'helm_rare',              weight: 3  },
    // Body
    { itemId: 'body_common',            weight: 8  },
    { itemId: 'body_rare',              weight: 3  },
    { itemId: 'body_epic',              weight: 1  },
    // Legs
    { itemId: 'legs_common',            weight: 6  },
    // Shoes
    { itemId: 'boots_common',           weight: 5  },
    { itemId: 'boots_rare',             weight: 3  },
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

/** 보스 드롭: 1~3개 확정 드롭 (확률 체크 없이 무조건 아이템 반환) */
export function rollBossDrops(): string[] {
    const count = 1 + Math.floor(Math.random() * 3); // 1~3
    const results: string[] = [];
    const totalWeight = DROP_TABLE.reduce((sum, e) => sum + e.weight, 0);

    for (let i = 0; i < count; i++) {
        let roll = Math.random() * totalWeight;
        for (const entry of DROP_TABLE) {
            roll -= entry.weight;
            if (roll <= 0) { results.push(entry.itemId); break; }
        }
        if (results.length <= i) results.push(DROP_TABLE[0].itemId);
    }

    return results;
}
