import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FORTEM_SECRET_KEY = process.env.FORTEM_SECRET_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text();
        const signature = req.headers.get('x-fortem-signature');
        const timestamp = req.headers.get('x-fortem-timestamp');

        if (!signature) {
            console.warn('[Webhook Error] Missing x-fortem-signature header.');
            return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
        }

        // #12. Replay 공격 미방어 (타임스탬프 검증)
        if (timestamp) {
            const now = Math.floor(Date.now() / 1000);
            const ts = parseInt(timestamp, 10);
            if (isNaN(ts) || Math.abs(now - ts) > 300) { // 5분
                console.warn(`[Webhook Error] Replay attempt or clock skew. TS: ${timestamp}, Now: ${now}`);
                return NextResponse.json({ error: 'Timestamp expired' }, { status: 403 });
            }
        }

        // #04. 서명 비교 타이밍 공격 방어
        const expectedSignature = crypto
            .createHmac('sha256', FORTEM_SECRET_KEY)
            .update(rawBody)
            .digest('hex');

        const expectedBuf = Buffer.from(expectedSignature, 'hex');
        const signatureBuf = Buffer.from(signature, 'hex');

        if (expectedBuf.length !== signatureBuf.length ||
            !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
            console.error('[Webhook Error] Invalid signature detected.');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
        }

        const body = JSON.parse(rawBody);
        const { game_user_id, in_game_item_id, redeem_tx_hash, nft_token_id } = body;

        if (!game_user_id || !in_game_item_id || !redeem_tx_hash) {
            console.error('[Webhook Error] Missing required fields in payload:', body);
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // #02 & #16. 멱등성 보장 (INSERT 후 충돌 처리)
        // Note: DB에 unique_redeem_tx_hash 제약 조건이 걸려 있어야 합니다.
        const { error: insertError } = await supabase
            .from('inventory')
            .insert({
                game_user_id: game_user_id,
                in_game_item_id: in_game_item_id,
                is_minted: false,
                status: 'available',
                redeem_tx_hash: redeem_tx_hash,
                updated_at: new Date().toISOString()
            });

        if (insertError) {
            // #02. code 23505 = unique violation
            if (insertError.code === '23505') {
                console.log(`[Webhook Info] Item already granted for tx: ${redeem_tx_hash}. Skipping duplicate.`);
                return NextResponse.json({ status: 'already_processed' }, { status: 200 });
            }
            throw new Error(`DB Insert Failed: ${insertError.message}`);
        }

        console.log(`[Webhook Success] Item '${in_game_item_id}' successfully redeemed for user '${game_user_id}'. Token ID: ${nft_token_id}`);
        return NextResponse.json({ status: 'success' }, { status: 200 });

    } catch (error: any) {
        console.error('[Webhook Exception]:', error.message);
        // #09 유사 마스킹: 에러 상세 정보는 서버 로그에만 남기고 클라이언트엔 전용 메시지
        return NextResponse.json(
            { error: 'Internal Server Error during Webhook Processing' },
            { status: 500 }
        );
    }
}
