import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const FORTEM_SECRET_KEY = process.env.FORTEM_SECRET_KEY!;

/**
 * POST /api/webhook/fortem
 *
 * ForTem이 비동기 민팅 처리 완료/실패 후 호출하는 웹훅 엔드포인트.
 * - 서명 검증 (HMAC-SHA256, timingSafeEqual)
 * - Replay 공격 방어 (타임스탬프 ±5분)
 * - DB inventory.status → 'minted' | 'mint_failed' 업데이트
 * - 멱등성 보장 (redeem_tx_hash UNIQUE 제약)
 *
 * ForTem 페이로드 예시:
 * {
 *   "transaction_id": "0xabc...",
 *   "status": "success" | "failed",
 *   "redeem_code": "<redeemCode used at mint time>"
 * }
 */
export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text();
        const signature = req.headers.get('x-fortem-signature');
        const timestamp  = req.headers.get('x-fortem-timestamp');

        // 서명 헤더 필수
        if (!signature) {
            console.warn('[Webhook/fortem] Missing x-fortem-signature');
            return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
        }

        // Replay 공격 방어: 타임스탬프 ±5분 허용
        if (timestamp) {
            const now = Math.floor(Date.now() / 1000);
            const ts  = parseInt(timestamp, 10);
            if (isNaN(ts) || Math.abs(now - ts) > 300) {
                console.warn(`[Webhook/fortem] Replay guard failed. ts=${timestamp} now=${now}`);
                return NextResponse.json({ error: 'Timestamp expired' }, { status: 403 });
            }
        }

        // HMAC-SHA256 서명 검증 (timingSafeEqual — 타이밍 공격 방어)
        const expected    = crypto.createHmac('sha256', FORTEM_SECRET_KEY).update(rawBody).digest('hex');
        const expectedBuf = Buffer.from(expected, 'hex');
        const actualBuf   = Buffer.from(signature, 'hex');

        if (
            expectedBuf.length !== actualBuf.length ||
            !crypto.timingSafeEqual(expectedBuf, actualBuf)
        ) {
            console.error('[Webhook/fortem] Invalid signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
        }

        // 페이로드 파싱
        const body = JSON.parse(rawBody);
        const { transaction_id, status, redeem_code } = body;

        if (!transaction_id || !status || !redeem_code) {
            console.error('[Webhook/fortem] Missing fields:', body);
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const isMinted = status === 'success';
        const newStatus = isMinted ? 'minted' : 'mint_failed';

        // redeem_code로 민팅 중인 아이템을 특정하여 상태 업데이트
        // - minted: is_minted=true, redeem_tx_hash 기록
        // - mint_failed: is_minted=false (재시도 가능하도록 잠금 해제)
        const updatePayload: Record<string, unknown> = {
            status: newStatus,
            updated_at: new Date().toISOString(),
        };
        if (isMinted) {
            updatePayload.is_minted       = true;
            updatePayload.redeem_tx_hash  = transaction_id;
        } else {
            updatePayload.is_minted = false;
        }

        const { data: updatedRows, error: updateError } = await supabase
            .from('inventory')
            .update(updatePayload)
            .eq('status', 'minting_in_progress')
            .eq('item_uid', redeem_code)          // qty=1 단건 경로
            .select('id');

        // qty>1 번들의 경우 redeem_code는 SHA256 해시 — item_uid와 다름.
        // 이 경우 redeem_tx_hash 컬럼(민팅 요청 시 미리 기록)을 기준으로 재시도.
        if (updateError || (updatedRows?.length ?? 0) === 0) {
            const { error: fallbackError } = await supabase
                .from('inventory')
                .update(updatePayload)
                .eq('status', 'minting_in_progress')
                .eq('redeem_tx_hash', transaction_id);

            if (fallbackError) {
                console.error('[Webhook/fortem] DB update failed:', fallbackError.message);
                return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
            }
        }

        console.log(`[Webhook/fortem] tx=${transaction_id} status=${newStatus} redeem_code=${redeem_code}`);
        return NextResponse.json({ status: 'ok', result: newStatus }, { status: 200 });

    } catch (error: any) {
        console.error('[Webhook/fortem] Exception:', error.message);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
