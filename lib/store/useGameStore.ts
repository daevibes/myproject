import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ItemDef, EquipSlotId, ITEM_DEFS } from '@/game/config/items';
import { INVENTORY_MAX_SLOTS, BURN_POINT_REWARD, SKILL_GAUGE_MAX } from '@/game/config/constants';

export interface OwnedItem {
    uid: string;
    itemId: string;
    def: ItemDef;
}

type EquippedMap = Record<EquipSlotId, OwnedItem | null>;

const STORE_VERSION = 6; // 구버전 localStorage는 def 재바인딩 후 마이그레이션

const DEFAULT_EQUIPPED: EquippedMap = {
    Head: null,
    Body: null,
    Legs: null,
    Shoes: null,
    RightHand: null,
    LeftHand: null,
};

interface GameState {
    _version: number;
    userId: string | null;
    sessionToken: string | null;
    inventory: OwnedItem[];
    pendingInventory: OwnedItem[];
    equipped: EquippedMap;
    skillGauge: number;         // 0~100
    points: number;
    walletAddress: string | null;

    addItem: (item: OwnedItem) => boolean;
    addPendingItem: (item: OwnedItem) => boolean;
    flushPendingInventory: () => OwnedItem[];
    removeItem: (uid: string) => void;
    burnItem: (uid: string) => void;
    burnItems: (uids: string[]) => void;
    equip: (slotId: EquipSlotId, item: OwnedItem) => void;
    unequip: (slotId: EquipSlotId) => void;
    canPickUp: () => boolean;
    addPoints: (amount: number) => void;
    setWalletAddress: (address: string) => void;
    addSkillGauge: (pct: number) => void;
    setSkillGauge: (val: number) => void;
}

export const useGameStore = create<GameState>()(
    persist(
        (set, get) => ({
            _version: STORE_VERSION,
            userId: null,
            sessionToken: null,
            inventory: [],
            pendingInventory: [],
            equipped: { ...DEFAULT_EQUIPPED },
            skillGauge: 0,
            points: 0,
            walletAddress: null,

            addItem: (item) => {
                if (get().inventory.length >= INVENTORY_MAX_SLOTS) return false;
                set((s) => ({ inventory: [...s.inventory, item] }));
                return true;
            },

            addPendingItem: (item) => {
                const { inventory, pendingInventory } = get();
                if (inventory.length + pendingInventory.length >= INVENTORY_MAX_SLOTS) return false;
                set((s) => ({ pendingInventory: [...s.pendingInventory, item] }));
                return true;
            },

            flushPendingInventory: () => {
                const { pendingInventory } = get();
                if (pendingInventory.length === 0) return [];
                set((s) => ({
                    inventory: [...s.inventory, ...s.pendingInventory],
                    pendingInventory: [],
                }));
                return pendingInventory;
            },

            removeItem: (uid) => {
                set((s) => ({
                    inventory: s.inventory.filter((i) => i.uid !== uid),
                    equipped: Object.fromEntries(
                        Object.entries(s.equipped).map(([k, v]) => [k, v?.uid === uid ? null : v])
                    ) as EquippedMap,
                }));
            },

            burnItem: (uid) => {
                const state = get();
                const item = state.inventory.find((i) => i.uid === uid);
                if (!item) return;
                state.removeItem(uid);
                set((s) => ({ points: s.points + BURN_POINT_REWARD }));
            },

            burnItems: (uids) => {
                const state = get();
                const validUids = uids.filter((uid) => state.inventory.some((i) => i.uid === uid));
                if (validUids.length === 0) return;
                const uidSet = new Set(validUids);
                set((s) => ({
                    inventory: s.inventory.filter((i) => !uidSet.has(i.uid)),
                    equipped: Object.fromEntries(
                        Object.entries(s.equipped).map(([k, v]) => [k, v && uidSet.has(v.uid) ? null : v])
                    ) as EquippedMap,
                    points: s.points + validUids.length * BURN_POINT_REWARD,
                }));
            },

            equip: (slotId, item) => {
                // 슬롯 호환성 체크: 기본 슬롯 OR LeftHand에 Sword 허용 (쌍검)
                const isCompatible =
                    item.def.slot === slotId ||
                    (slotId === 'LeftHand' && item.def.weaponType === 'Sword');
                if (!isCompatible) return;

                if (item.def.isTwoHanded) {
                    // 양손 무기: RightHand + LeftHand 동시 점유
                    set((s) => ({
                        equipped: { ...s.equipped, RightHand: item, LeftHand: item },
                    }));
                } else {
                    // 양손 무기가 현재 장착되어 있으면 두 슬롯 모두 해제
                    const current = get().equipped;
                    const isRightTwoHanded = current.RightHand?.def.isTwoHanded;
                    const newEquipped = { ...current, [slotId]: item };
                    if (isRightTwoHanded && (slotId === 'RightHand' || slotId === 'LeftHand')) {
                        newEquipped.RightHand = slotId === 'RightHand' ? item : null;
                        newEquipped.LeftHand = slotId === 'LeftHand' ? item : null;
                    } else {
                        newEquipped[slotId] = item;
                    }
                    set(() => ({ equipped: newEquipped }));
                }
            },

            unequip: (slotId) => {
                const current = get().equipped;
                const item = current[slotId];
                if (!item) return;
                if (item.def.isTwoHanded) {
                    // 양손 무기 해제: 양쪽 모두 비움
                    set((s) => ({
                        equipped: { ...s.equipped, RightHand: null, LeftHand: null },
                    }));
                } else {
                    set((s) => ({
                        equipped: { ...s.equipped, [slotId]: null },
                    }));
                }
            },

            canPickUp: () => {
                const { inventory, pendingInventory } = get();
                return inventory.length + pendingInventory.length < INVENTORY_MAX_SLOTS;
            },

            addPoints: (amount) => set((s) => ({ points: s.points + amount })),

            setWalletAddress: (address) => set({ walletAddress: address }),

            addSkillGauge: (pct) =>
                set((s) => ({ skillGauge: Math.min(SKILL_GAUGE_MAX, s.skillGauge + pct) })),

            setSkillGauge: (val) => set({ skillGauge: Math.max(0, Math.min(SKILL_GAUGE_MAX, val)) }),
        }),
        {
            name: 'game-store',
            version: STORE_VERSION,
            migrate: (persisted: any, version: number) => {
                let state = persisted as any;

                if (version < 6) {
                    // 인벤토리: def를 최신 ITEM_DEFS로 강제 교체
                    const fixedInventory = (state.inventory || [])
                        .map((i: any) => ({ ...i, def: ITEM_DEFS[i.itemId] }))
                        .filter((i: any) => i.def != null);

                    // 장착 슬롯: def를 최신 ITEM_DEFS로 강제 교체
                    const fixedEquipped: any = { ...DEFAULT_EQUIPPED };
                    if (state.equipped && !Array.isArray(state.equipped)) {
                        for (const key in state.equipped) {
                            const item = state.equipped[key as EquipSlotId];
                            if (item) {
                                const def = ITEM_DEFS[item.itemId];
                                if (def) {
                                    fixedEquipped[key as EquipSlotId] = { ...item, def };
                                }
                            }
                        }
                    }

                    state = {
                        ...state,
                        inventory: fixedInventory,
                        equipped: fixedEquipped,
                        skillGauge: state.skillGauge || 0,
                        _version: 6,
                    };
                }
                return state as GameState;
            },
            partialize: (state) => ({
                _version: state._version,
                inventory: state.inventory,
                equipped: state.equipped,
                points: state.points,
                walletAddress: state.walletAddress,
            }),
        }
    )
);
