import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FortemClient } from '@fortemlabs/sdk-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const SUI_ADDRESS_REGEX = /^0x[a-fA-F0-9]{64}$/;

export async function POST(req: NextRequest) {
    let lockedItemId: string | null = null;
    try {
        const body = await req.json();
        const { game_user_id, in_game_item_id, metadata, wallet_address } = body;

        // #10 & #14 & NEW-4: 유효성 검사 및 메타데이터 필터링
        if (!game_user_id || !in_game_item_id || !wallet_address || !SUI_ADDRESS_REGEX.test(wallet_address)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }
        const ALLOWED_TRAITS = ['Attack', 'Defense', 'HP', 'Speed'];
        const safeMetadata = {
            name: metadata?.name || in_game_item_id,
            attributes: Array.isArray(metadata?.attributes)
                ? metadata.attributes
                    .filter((a: any) => ALLOWED_TRAITS.includes(a.trait_type))
                    .map((a: any) => ({ trait_type: String(a.trait_type), value: Number(a.value) || 0 }))
                : []
        };

        // #01 & NEW-1: 원자적 잠금 (민팅 실패 재시도 허용)
        const { data: locked, error: lockError } = await supabase
            .from('inventory')
            .update({ is_minted: true, status: 'minting_in_progress' })
            .eq('game_user_id', game_user_id)
            .eq('in_game_item_id', in_game_item_id)
            .eq('is_minted', false)
            .in('status', ['available', 'mint_failed'])
            .select('id')
            .single();

        if (lockError || !locked) return NextResponse.json({ error: 'Item unavailable' }, { status: 409 });
        lockedItemId = locked.id;

        // #07, #08: 서버 고정 환경변수 사용
        const fortem = new FortemClient({
            secretKey: process.env.FORTEM_SECRET_KEY!,
            network: process.env.FORTEM_NETWORK as any,
        });

        const mintResponse = await fortem.mint.exportItem({
            studioId: process.env.FORTEM_STUDIO_ID!,
            userId: game_user_id,
            collectionId: process.env.FORTEM_COLLECTION_ID!,
            itemId: in_game_item_id,
            metadata: safeMetadata,
            recipientAddress: wallet_address,
        });

        if (!mintResponse.success) throw new Error(mintResponse.errorMessage);
        // NEW-3: 클라이언트와 통신 키 맞춤 (tx -> transaction_id)
        return NextResponse.json({ status: 'success', transaction_id: mintResponse.transactionId });

    } catch (error: any) {
        console.error('[MINT_CRITICAL]:', error.message);
        if (lockedItemId) {
            const { error: rbErr } = await supabase.from('inventory')
                .update({ is_minted: false, status: 'mint_failed' }) // #05 적용
                .eq('id', lockedItemId);
            if (rbErr) console.error(`[ROLLBACK_FAILED] ID: ${lockedItemId}`, rbErr.message); // #06 적용
        }
        return NextResponse.json({ error: 'MINT_PROCESS_FAILED' }, { status: 500 }); // #09 적용
    }
}