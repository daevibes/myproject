export interface InventoryItem {
    id: string;
    game_user_id: string;
    in_game_item_id: string;
    item_uid: string;
    is_minted: boolean;
    status: 'available' | 'minting_in_progress' | 'minted' | 'mint_failed';
    redeem_tx_hash?: string;
    created_at: string;
    updated_at: string;
}
