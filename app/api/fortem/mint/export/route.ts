import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FortemClient } from '@fortemlabs/sdk-js'; // ForTem SDK 가정

// 서버 환경 변수 가져오기 (클라이언트 노출 절대 불가)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // 서버 전용 Admin Key
const FORTEM_SECRET_KEY = process.env.FORTEM_SECRET_KEY!;

// Supabase Admin 클라이언트 초기화 (보안 우회 검증용)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studio_id, game_user_id, network, in_game_item_id, metadata } = body;

    // 1. 필수 파라미터 검증
    if (!studio_id || !game_user_id || !in_game_item_id || !network) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // 2. Supabase DB에서 유저의 아이템 소유 여부 검증 (어뷰징 방지)
    const { data: inventoryItem, error: dbError } = await supabase
      .from('inventory')
      .select('*')
      .eq('game_user_id', game_user_id)
      .eq('in_game_item_id', in_game_item_id)
      .eq('is_minted', false) // 아직 민팅되지 않은 아이템인지 확인
      .single();

    if (dbError || !inventoryItem) {
      console.error(`[Mint Error] Item not found or already minted. User: ${game_user_id}, Item: ${in_game_item_id}`);
      return NextResponse.json(
        { error: 'Item not found in inventory or already exported.' },
        { status: 403 }
      );
    }

    // 3. 아이템을 '민팅 진행 중' 상태로 잠금 (Lock) - 중복 민팅 방지
    await supabase
      .from('inventory')
      .update({ is_minted: true, status: 'minting_in_progress' })
      .eq('id', inventoryItem.id);

    // 4. ForTem SDK를 통한 Mint(Export) API 호출
    const fortem = new FortemClient({
      secretKey: FORTEM_SECRET_KEY,
      network: network, // 'sui-testnet'
    });

    const mintResponse = await fortem.mint.exportItem({
      studioId: studio_id,
      userId: game_user_id,
      itemId: in_game_item_id,
      metadata: metadata,
    });

    if (!mintResponse.success) {
      throw new Error(`ForTem API Failed: ${mintResponse.errorMessage}`);
    }

    // 5. 성공 응답
    return NextResponse.json(
      {
        status: 'processing',
        transaction_id: mintResponse.transactionId,
        message: 'NFT 민팅이 성공적으로 요청되었습니다.',
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('[Mint Exception]:', error.message);
    
    // 에러 발생 시 잠가두었던 아이템 상태를 롤백하는 로직 추가 가능 (선택 사항)
    
    return NextResponse.json(
      { error: 'Internal Server Error during Minting Process' },
      { status: 500 }
    );
  }
}
