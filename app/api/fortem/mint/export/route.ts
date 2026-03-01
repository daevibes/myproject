import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FortemClient } from '@fortemlabs/sdk-js';
import crypto from 'crypto';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const SUI_ADDRESS_REGEX = /^0x[a-fA-F0-9]{64}$/;

export async function POST(req: NextRequest) {
    let lockedIds: string[] = [];
    try {
        const body = await req.json();
        const { game_user_id, in_game_item_id, quantity = 1, metadata, wallet_address } = body;

        // 기본 파라미터 유효성 검사
        if (!game_user_id || !in_game_item_id || !wallet_address || !SUI_ADDRESS_REGEX.test(wallet_address)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        // 수량 유효성 검사 (1~20개, 정수만)
        const qty = Math.floor(Number(quantity));
        if (!Number.isFinite(qty) || qty < 1 || qty > 20) {
            return NextResponse.json({ error: 'Invalid quantity (1-20)' }, { status: 400 });
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

        // N개 원자적 잠금: limit(N)으로 정확히 N개 로우만 잠금
        const { data: locked, error: lockError } = await supabase
            .from('inventory')
            .update({ is_minted: true, status: 'minting_in_progress' })
            .eq('game_user_id', game_user_id)
            .eq('in_game_item_id', in_game_item_id)
            .eq('is_minted', false)
            .in('status', ['available', 'mint_failed'])
            .select('id, item_uid')
            .limit(qty);

        if (lockError) return NextResponse.json({ error: 'Item unavailable' }, { status: 409 });

        if (!locked || locked.length < qty) {
            // 부분 잠금된 로우는 available로 롤백
            if (locked && locked.length > 0) {
                await supabase.from('inventory')
                    .update({ is_minted: false, status: 'available' })
                    .in('id', locked.map((r: any) => r.id));
            }
            return NextResponse.json({ error: 'Insufficient available items' }, { status: 409 });
        }

        lockedIds = locked.map((r: any) => r.id);

        // redeemCode: 멱등성 보장 (동일 아이템 묶음 재시도 시 동일 코드)
        const sortedUids = locked.map((r: any) => r.item_uid as string).sort();
        const redeemCode = qty === 1
            ? sortedUids[0]
            : crypto.createHash('sha256').update(sortedUids.join('|')).digest('hex').slice(0, 32);

        const fortem = new FortemClient({
            apiKey: process.env.FORTEM_SECRET_KEY!,
            network: process.env.FORTEM_NETWORK as any,
        });

        const bundleName = qty > 1 ? `${safeMetadata.name} x${qty}` : safeMetadata.name;
        const mintResponse = await fortem.items.create(Number(process.env.FORTEM_COLLECTION_ID!), {
            name: bundleName,
            quantity: 1, // 항상 1개의 통짜(Indivisible) 묶음 NFT
            redeemCode,
            description: qty > 1
                ? `${qty}개 묶음 NFT (Indivisible Bundle) — ForTem Survivor`
                : 'Exported from ForTem Survivor',
            recipientAddress: wallet_address,
            attributes: [
                ...safeMetadata.attributes.map((a: any) => ({ name: a.trait_type, value: String(a.value) })),
                ...(qty > 1 ? [{ name: 'In-Game Quantity', value: String(qty) }] : []),
            ]
        });

        if (mintResponse.statusCode !== 200) throw new Error('Minting failed with status: ' + mintResponse.statusCode);

        // 민팅 성공: N개 DB 로우 모두 minted 처리
        await supabase.from('inventory')
            .update({ status: 'minted', is_minted: true, redeem_tx_hash: mintResponse.data?.objectId })
            .in('id', lockedIds);

        return NextResponse.json({
            status: 'success',
            transaction_id: mintResponse.data?.objectId || 'pending',
            quantity: qty,
        });

    } catch (error: any) {
        console.error('[MINT_CRITICAL]:', error.message);
        if (lockedIds.length > 0) {
            const { error: rbErr } = await supabase.from('inventory')
                .update({ is_minted: false, status: 'mint_failed' })
                .in('id', lockedIds);
            if (rbErr) console.error('[ROLLBACK_FAILED] IDs:', lockedIds, rbErr.message);
        }
        return NextResponse.json({ error: 'MINT_PROCESS_FAILED' }, { status: 500 });
    }
}
