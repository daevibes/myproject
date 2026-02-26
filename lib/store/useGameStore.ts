import { create } from 'zustand';

interface GameState {
    inventory: any[];
    walletAddress: string | null;
    setInventory: (items: any[]) => void;
    setWalletAddress: (address: string) => void;
}

export const useGameStore = create<GameState>((set) => ({
    inventory: [],
    walletAddress: null,
    setInventory: (items) => set({ inventory: items }),
    setWalletAddress: (address) => set({ walletAddress: address }),
}));
