import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ITEM_DEFS } from '@/game/config/items';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    const { game_user_id, items } = await req.json();

    if (!game_user_id || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // JWT 소유권 검증
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || user.id !== game_user_id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 유효한 아이템만 필터링 (알려진 in_game_item_id만 허용)
    const validItems = items
        .filter((item: any) =>
            item.in_game_item_id &&
            item.item_uid &&
            ITEM_DEFS[item.in_game_item_id]
        )
        .map((item: any) => ({
            game_user_id,
            in_game_item_id: String(item.in_game_item_id),
            item_uid: String(item.item_uid),
            is_minted: false,
            status: 'available',
        }));

    if (validItems.length === 0) {
        return NextResponse.json({ message: 'No valid items to save', saved: 0 }, { status: 200 });
    }

    // 일괄 upsert — 중복 item_uid는 무시 (멱등성 보장)
    const { data, error } = await supabase
        .from('inventory')
        .upsert(validItems, { onConflict: 'item_uid', ignoreDuplicates: true })
        .select('id');

    if (error) {
        console.error('[Batch Insert Error]:', error.message);
        return NextResponse.json({ error: '아이템 일괄 저장 실패' }, { status: 500 });
    }

    return NextResponse.json({
        message: `${validItems.length}개 아이템 저장 완료`,
        saved: data?.length ?? 0,
    }, { status: 200 });
}
