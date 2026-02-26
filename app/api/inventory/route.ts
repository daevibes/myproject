import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data }, { status: 200 });
}

export async function POST(req: NextRequest) {
    const { game_user_id } = await req.json();

    const dummyItem = {
        game_user_id: game_user_id,
        in_game_item_id: `sword_lv${Math.floor(Math.random() * 99) + 1}`,
        is_minted: false,
        status: 'available'
    };

    const { data, error } = await supabase.from('inventory').insert(dummyItem).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: 'Sample item created', item: data }, { status: 200 });
}
