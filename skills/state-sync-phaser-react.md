---
name: State Sync Phaser ↔ React
description: Zustand를 사용한 Phaser(게임)와 React(UI) 간 단방향 데이터 흐름 아키텍처
---

# State Sync: Phaser ↔ React

## 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────┐
│                  Zustand Store                       │
│  inventory[] | walletAddress | score | gamePhase     │
├─────────────────────────────────────────────────────┤
│         │                           │                │
│    getState()                  useStore()            │
│    setState()                  (React Hook)          │
│    subscribe()                                       │
│         │                           │                │
│    ┌────▼────┐               ┌──────▼──────┐        │
│    │ Phaser  │               │   React UI  │        │
│    │  Game   │               │  Components │        │
│    └─────────┘               └─────────────┘        │
└─────────────────────────────────────────────────────┘
```

## 규칙 1: 단일 진실의 원천 (Single Source of Truth)
- 게임 상태(인벤토리, 점수, 지갑)는 **오직 Zustand 스토어에만** 존재
- Phaser 씬의 로컬 변수는 **UI 표현 전용** (텍스트 오브젝트, 스프라이트 위치 등)
- DB 동기화가 필요한 데이터는 스토어 → API → DB 순서로 흐름

## 규칙 2: 단방향 데이터 흐름

```
이벤트 발생 (칼 챙김, 코인 획득)
    ↓
Zustand setState() 호출 (스토어 업데이트)
    ↓
┌──────────────────┬──────────────────┐
│  subscribe()     │   useStore()     │
│  Phaser 씬 갱신   │  React UI 갱신   │
└──────────────────┴──────────────────┘
```

## 규칙 3: API 호출은 스토어 액션에서

```typescript
// lib/store/useGameStore.ts
export const useGameStore = create<GameState>((set, get) => ({
  inventory: [],

  // API 호출 + 스토어 갱신을 하나의 액션으로 묶음
  fetchInventory: async (userId: string) => {
    const res = await fetch(`/api/inventory?game_user_id=${userId}`);
    const data = await res.json();
    if (data.items) set({ inventory: data.items });
  },

  exportItem: async (itemId: string) => {
    const { walletAddress } = get();
    if (!walletAddress) throw new Error('Wallet not connected');

    const res = await fetch('/api/fortem/mint/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game_user_id: 'usr_test_12345',
        in_game_item_id: itemId,
        wallet_address: walletAddress,
        metadata: { name: itemId, attributes: [] }
      }),
    });

    if (!res.ok) throw new Error('Export failed');

    // 성공 후 인벤토리 갱신
    await get().fetchInventory('usr_test_12345');
  },
}));
```

## 사용 위치별 접근 방법

| 위치 | 접근 방법 | 예시 |
|------|-----------|------|
| React 컴포넌트 | `useGameStore()` Hook | `const items = useGameStore(s => s.inventory)` |
| Phaser 씬 (읽기) | `useGameStore.getState()` | `const { score } = useGameStore.getState()` |
| Phaser 씬 (쓰기) | `useGameStore.getState().action()` | `useGameStore.getState().addScore(10)` |
| Phaser 씬 (감시) | `useGameStore.subscribe()` | 위 phaser4-zustand-sync.md 참조 |

## 안티패턴 (하지 말 것)

```typescript
// ❌ Phaser 씬에서 로컬 변수로 상태 관리
this.localInventory = [...]; // 스토어와 불일치 발생

// ❌ React에서 Phaser 오브젝트 직접 조작
gameRef.current.scene.getScene('Game').player.x = 100; // 커플링 심화

// ❌ update()에서 매 프레임 getState()
update() { const s = useGameStore.getState(); } // 성능 낭비
```
