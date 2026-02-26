---
name: Supabase Realtime
description: Supabase Realtime 채널을 구독하여 인벤토리 변경을 즉시 반영하는 방법
---

# Supabase Realtime

## 사용 시나리오
- 웹훅으로 리딤된 아이템이 DB에 추가되었을 때, **폴링 없이** 클라이언트에 즉시 반영
- 다른 기기에서 민팅한 아이템 상태 변화를 현재 접속 중인 화면에 자동 반영

## Supabase 대시보드 설정
1. Database → Replication 메뉴에서 `inventory` 테이블의 Realtime 활성화
2. `supabase_realtime` publication에 `inventory` 테이블 추가

## 클라이언트 구독 코드

```typescript
// lib/supabase/realtime.ts
import { createClient } from '@supabase/supabase-js';
import { useGameStore } from '@/lib/store/useGameStore';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // 클라이언트에서는 Anon Key 사용
);

export function subscribeToInventory(gameUserId: string) {
  const channel = supabase
    .channel('inventory-changes')
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE 전부
        schema: 'public',
        table: 'inventory',
        filter: `game_user_id=eq.${gameUserId}`,
      },
      (payload) => {
        console.log('[Realtime] Change received:', payload);
        // 변경 감지 시 인벤토리 전체 갱신
        useGameStore.getState().fetchInventory(gameUserId);
      }
    )
    .subscribe();

  // 구독 해제 함수 반환
  return () => {
    supabase.removeChannel(channel);
  };
}
```

## React에서 사용

```typescript
// app/inventory/page.tsx 또는 components/game/GameCanvas.tsx
import { useEffect } from 'react';
import { subscribeToInventory } from '@/lib/supabase/realtime';

useEffect(() => {
  const unsubscribe = subscribeToInventory('usr_test_12345');
  return () => unsubscribe();
}, []);
```

## Phaser 씬에서 사용

```typescript
// game/scenes/MainScene.ts
import { subscribeToInventory } from '@/lib/supabase/realtime';

export class MainScene extends Phaser.Scene {
  private unsubscribeRealtime?: () => void;

  create() {
    this.unsubscribeRealtime = subscribeToInventory('usr_test_12345');
  }

  shutdown() {
    this.unsubscribeRealtime?.();
  }
}
```

## Realtime vs Polling 비교

| 항목 | Polling | Realtime |
|------|---------|----------|
| 지연 시간 | 2~3초 (폴링 간격) | 즉시 (~100ms) |
| 서버 부하 | 높음 (반복 요청) | 낮음 (WebSocket) |
| 구현 복잡도 | 간단 | 약간 복잡 |
| Supabase 설정 | 불필요 | Replication 활성화 필요 |

## 주의사항
- Anon Key는 클라이언트에서 사용하므로 `NEXT_PUBLIC_` 접두어 필수
- RLS가 활성화되어 있으면, 클라이언트 Realtime도 RLS 정책에 따라 필터링됨
- Supabase Free 티어에서도 Realtime 사용 가능 (동시 연결 수 제한 있음)
- 컴포넌트/씬 언마운트 시 반드시 `removeChannel()` 호출하여 구독 해제
