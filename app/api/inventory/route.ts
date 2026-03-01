import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ITEM_DEFS } from '@/game/config/items';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const game_user_id = searchParams.get('game_user_id');

    if (!game_user_id) return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });

    const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('game_user_id', game_user_id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Inventory API Error]:', error.message);
        return NextResponse.json({ error: '인벤토리 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
    return NextResponse.json({ items: data }, { status: 200 });
}

export async function POST(req: NextRequest) {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    const { game_user_id, in_game_item_id, item_uid } = await req.json();

    if (!game_user_id || !in_game_item_id || !item_uid) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // JWT 소유권 검증: 토큰의 실제 유저 ID와 요청의 game_user_id 비교
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || user.id !== game_user_id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 아이템 ID 유효성 검증
    if (!ITEM_DEFS[in_game_item_id]) {
        return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
    }

    const itemData = {
        game_user_id,
        in_game_item_id,
        item_uid,
        is_minted: false,
        status: 'available'
    };

    const { data, error } = await supabase.from('inventory').insert(itemData).select().single();

    if (error) {
        // 이미 저장된 아이템인 경우 (중복 uid) 무시
        if (error.code === '23505') {
            return NextResponse.json({ message: 'Item already saved (dupe)' }, { status: 200 });
        }
        console.error('[Inventory Insert Error]:', error.message);
        return NextResponse.json({ error: '아이템 저장 실패' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Item saved successfully', item: data }, { status: 200 });
}
