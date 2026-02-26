---
name: Phaser 3 + Zustand Sync
description: Phaser 씬에서 Zustand 스토어를 읽고 쓰는 패턴
---

# Phaser 3 + Zustand Sync

## 핵심 원칙
- Zustand 스토어는 **React 외부에서도 직접 접근 가능** (`useGameStore.getState()`)
- Phaser 씬에서는 React Hook을 쓸 수 없으므로 `getState()` / `setState()` 직접 호출
- `subscribe()`로 스토어 변경을 감지하여 Phaser UI를 실시간 갱신

## Zustand 스토어 정의

```typescript
// lib/store/useGameStore.ts
import { create } from 'zustand';

interface InventoryItem {
  id: string;
  in_game_item_id: string;
  is_minted: boolean;
  status: string;
}

interface GameState {
  inventory: InventoryItem[];
  walletAddress: string | null;
  score: number;
  setInventory: (items: InventoryItem[]) => void;
  setWalletAddress: (address: string) => void;
  addScore: (points: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  inventory: [],
  walletAddress: null,
  score: 0,
  setInventory: (items) => set({ inventory: items }),
  setWalletAddress: (address) => set({ walletAddress: address }),
  addScore: (points) => set((state) => ({ score: state.score + points })),
}));
```

## Phaser 씬에서 스토어 읽기

```typescript
// game/scenes/ShopScene.ts
import { useGameStore } from '@/lib/store/useGameStore';

export class ShopScene extends Phaser.Scene {
  create() {
    // 현재 인벤토리 상태 가져오기
    const { inventory, walletAddress } = useGameStore.getState();

    inventory.forEach((item, index) => {
      this.add.text(50, 80 + index * 40, `${item.in_game_item_id} - ${item.status}`, {
        fontSize: '16px', color: '#ffffff'
      });
    });

    if (!walletAddress) {
      this.add.text(400, 500, '지갑이 연결되지 않았습니다', {
        fontSize: '18px', color: '#ff6666'
      }).setOrigin(0.5);
    }
  }
}
```

## Phaser 씬에서 스토어 쓰기

```typescript
// 아이템 획득 시 Zustand에 반영
collectItem(itemData: any) {
  const store = useGameStore.getState();
  const currentItems = store.inventory;
  store.setInventory([...currentItems, itemData]);
  store.addScore(50);
}
```

## 스토어 변경 구독 (실시간 UI 갱신)

```typescript
export class GameScene extends Phaser.Scene {
  private unsubscribe?: () => void;
  private scoreText!: Phaser.GameObjects.Text;

  create() {
    this.scoreText = this.add.text(10, 10, 'Score: 0', { fontSize: '24px', color: '#fff' });

    // Zustand 상태 변경 구독
    this.unsubscribe = useGameStore.subscribe(
      (state) => {
        this.scoreText.setText(`Score: ${state.score}`);
      }
    );
  }

  shutdown() {
    // 씬 종료 시 구독 해제 (메모리 누수 방지)
    this.unsubscribe?.();
  }
}
```

## 데이터 흐름 요약

```
[Phaser 씬] --getState()--> [Zustand Store] <--useStore()--> [React UI]
[Phaser 씬] --setState()--> [Zustand Store] --subscribe()--> [Phaser 씬]
```

## 주의사항
- Phaser 씬에서는 반드시 `useGameStore.getState()`로 접근 (Hook 사용 불가)
- `subscribe()`를 사용한 경우 `shutdown()` 또는 `destroy()`에서 반드시 해제
- 매 프레임(`update()`)에서 `getState()`를 호출하면 성능 저하 → `subscribe` 패턴 권장
