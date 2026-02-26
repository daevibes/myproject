import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FortemClient } from '@fortemlabs/sdk-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FORTEM_SECRET_KEY = process.env.FORTEM_SECRET_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function POST(req: NextRequest) {
    let lockedItemId: string | null = null;

    try {
        const body = await req.json();
        const { studio_id, game_user_id, network, in_game_item_id, metadata, wallet_address } = body;

        if (!studio_id || !game_user_id || !in_game_item_id || !network || !wallet_address) {
            return NextResponse.json({ error: 'Missing required parameters including wallet_address' }, { status: 400 });
        }

        const { data: inventoryItem, error: dbError } = await supabase
            .from('inventory')
            .select('id')
            .eq('game_user_id', game_user_id)
            .eq('in_game_item_id', in_game_item_id)
            .eq('is_minted', false)
            .single();

        if (dbError || !inventoryItem) {
            return NextResponse.json({ error: 'Item not found or already exported.' }, { status: 403 });
        }

        lockedItemId = inventoryItem.id;

        const { error: lockError } = await supabase
            .from('inventory')
            .update({ is_minted: true, status: 'minting_in_progress' })
            .eq('id', lockedItemId);

        if (lockError) throw new Error(`Lock failed: ${lockError.message}`);

        const fortem = new FortemClient({
            secretKey: FORTEM_SECRET_KEY,
            network: network,
        });

        const mintResponse = await fortem.mint.exportItem({
            studioId: studio_id,
            userId: game_user_id,
            collectionId: process.env.FORTEM_COLLECTION_ID!,
            itemId: in_game_item_id,
            metadata: metadata,
            recipientAddress: wallet_address,
        });

        if (!mintResponse.success) {
            throw new Error(`ForTem API Failed: ${mintResponse.errorMessage}`);
        }

        return NextResponse.json({
            status: 'processing',
            transaction_id: mintResponse.transactionId,
            message: 'NFT 민팅 요청 완료',
        }, { status: 200 });

    } catch (error: any) {
        console.error('[Mint Exception]:', error.message);

        if (lockedItemId) {
            console.log(`[Mint Rollback] Reverting DB ID: ${lockedItemId}`);
            await supabase
                .from('inventory')
                .update({ is_minted: false, status: 'available' })
                .eq('id', lockedItemId);
        }

        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}