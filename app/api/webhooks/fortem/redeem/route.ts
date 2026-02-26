import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto'; // Node.js 내장 암호화 모듈 (설치 불필요)

// 서버 환경 변수
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // DB 강제 주입을 위한 Admin Key
const FORTEM_SECRET_KEY = process.env.FORTEM_SECRET_KEY!; // 서명 검증용 시크릿 키

// Supabase Admin 클라이언트 초기화
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function POST(req: NextRequest) {
    try {
        // 1. Raw Body 추출 및 서명(Signature) 검증 (가짜 요청 해킹 차단)
        // 서명 검증을 위해 JSON 파싱 전의 원본 문자열(text)이 필요합니다.
        const rawBody = await req.text();
        const signature = req.headers.get('x-fortem-signature');

        if (!signature) {
            console.warn('[Webhook Error] Missing x-fortem-signature header. Blocked.');
            return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
        }

        // HMAC SHA256을 이용해 우리 서버가 가진 Secret Key로 해시값을 직접 만들어 비교
        const expectedSignature = crypto
            .createHmac('sha256', FORTEM_SECRET_KEY)
            .update(rawBody)
            .digest('hex');

        if (signature !== expectedSignature) {
            console.error('[Webhook Error] Invalid signature detected. Possible hacking attempt.');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
        }

        // 2. 서명 검증 통과 후 Body 파싱
        const body = JSON.parse(rawBody);
        const { studio_id, game_user_id, network, nft_token_id, in_game_item_id, redeem_tx_hash } = body;

        // 필수 파라미터 누락 체크
        if (!game_user_id || !in_game_item_id || !redeem_tx_hash) {
            console.error('[Webhook Error] Missing required fields in payload:', body);
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 3. [필수] 멱등성(Idempotency) 검증 - 아이템 중복 복사 방지
        // 동일한 트랜잭션 해시(redeem_tx_hash)로 이미 아이템을 지급했는지 확인합니다.
        const { data: existingItem, error: checkError } = await supabase
            .from('inventory')
            .select('id')
            .eq('redeem_tx_hash', redeem_tx_hash)
            .single();

        if (existingItem) {
            // 이미 처리된 웹훅이 재전송된 경우, 아이템을 또 주지 않고 성공(200)만 반환하여 ForTem 서버를 안심시킴
            console.log(`[Webhook Info] Item already granted for tx: ${redeem_tx_hash}. Skipping duplicate.`);
            return NextResponse.json({ status: 'already_processed' }, { status: 200 });
        }

        // 4. 인게임 인벤토리에 아이템 지급 (Insert)
        // NFT가 다시 게임 속 아이템으로 돌아왔으므로 is_minted는 false가 됩니다.
        const { error: insertError } = await supabase
            .from('inventory')
            .insert({
                game_user_id: game_user_id,
                in_game_item_id: in_game_item_id,
                is_minted: false,           // 다시 게임 내 아이템 상태로
                status: 'available',        // 사용 가능 상태
                redeem_tx_hash: redeem_tx_hash, // 중복 방지를 위한 기록
                updated_at: new Date().toISOString()
            });

        if (insertError) {
            throw new Error(`DB Insert Failed: ${insertError.message}`);
        }

        console.log(`[Webhook Success] Item '${in_game_item_id}' successfully redeemed for user '${game_user_id}'. Token ID: ${nft_token_id}`);

        // 5. 성공 응답 (ForTem 서버에게 정상 처리 완료를 알림)
        return NextResponse.json({ status: 'success' }, { status: 200 });

    } catch (error: any) {
        console.error('[Webhook Exception]:', error.message);

        // 500 에러를 반환하면 ForTem 서버가 나중에 웹훅을 다시 쏴줄 수 있습니다.
        return NextResponse.json(
            { error: 'Internal Server Error during Webhook Processing' },
            { status: 500 }
        );
    }
}
