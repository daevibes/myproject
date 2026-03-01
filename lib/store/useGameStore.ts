import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ItemDef, EQUIP_SLOTS } from '@/game/config/items';
import { INVENTORY_MAX_SLOTS, BURN_POINT_REWARD } from '@/game/config/constants';

export interface OwnedItem {
    uid: string;
    itemId: string;
    def: ItemDef;
}

type EquipSlotId = (typeof EQUIP_SLOTS)[number]['id'];

interface GameState {
    userId: string | null;
    sessionToken: string | null;
    inventory: OwnedItem[];
    pendingInventory: OwnedItem[]; // 인게임 임시 저장 (비저장, 게임 종료 시 일괄 flush)
    equipped: Record<EquipSlotId, OwnedItem | null>;
    points: number;
    walletAddress: string | null;

    addItem: (item: OwnedItem) => boolean;
    addPendingItem: (item: OwnedItem) => boolean;
    flushPendingInventory: () => OwnedItem[];
    removeItem: (uid: string) => void;
    burnItem: (uid: string) => void;
    equip: (slotId: EquipSlotId, item: OwnedItem) => void;
    unequip: (slotId: EquipSlotId) => void;
    canPickUp: () => boolean;
    addPoints: (amount: number) => void;
    setWalletAddress: (address: string) => void;
}

export const useGameStore = create<GameState>()(
    persist(
        (set, get) => ({
            userId: null,
            sessionToken: null,
            inventory: [],
            pendingInventory: [],
            equipped: { weapon: null, armor: null },
            points: 0,
            walletAddress: null,

            addItem: (item) => {
                if (get().inventory.length >= INVENTORY_MAX_SLOTS) return false;
                set((s) => ({ inventory: [...s.inventory, item] }));
                return true;
            },

            // 인게임 픽업 → 임시 보관 (DB 저장 안 함, 브라우저 종료 시 소멸)
            addPendingItem: (item) => {
                const { inventory, pendingInventory } = get();
                if (inventory.length + pendingInventory.length >= INVENTORY_MAX_SLOTS) return false;
                set((s) => ({ pendingInventory: [...s.pendingInventory, item] }));
                return true;
            },

            // 게임 종료 시 pending → inventory 이동 + 목록 반환 (DB 일괄 저장용)
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
                    ) as Record<EquipSlotId, OwnedItem | null>,
                }));
            },

            burnItem: (uid) => {
                const state = get();
                const item = state.inventory.find((i) => i.uid === uid);
                if (!item) return;
                state.removeItem(uid);
                set((s) => ({ points: s.points + BURN_POINT_REWARD }));
            },

            equip: (slotId, item) => {
                const slot = EQUIP_SLOTS.find((s) => s.id === slotId);
                if (!slot || item.def.type !== slot.type) return;
                set((s) => ({
                    equipped: { ...s.equipped, [slotId]: item },
                }));
            },

            unequip: (slotId) => {
                set((s) => ({
                    equipped: { ...s.equipped, [slotId]: null },
                }));
            },

            // inventory + pendingInventory 합산으로 슬롯 체크
            canPickUp: () => {
                const { inventory, pendingInventory } = get();
                return inventory.length + pendingInventory.length < INVENTORY_MAX_SLOTS;
            },

            addPoints: (amount) => set((s) => ({ points: s.points + amount })),

            setWalletAddress: (address) => set({ walletAddress: address }),
        }),
        {
            name: 'game-store',
            partialize: (state) => ({
                inventory: state.inventory,
                equipped: state.equipped,
                points: state.points,
                walletAddress: state.walletAddress,
            }),
        }
    )
);
