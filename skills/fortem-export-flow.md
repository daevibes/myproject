---
name: ForTem Export Flow
description: Phaser 씬에서 NFT 민팅(Export)을 트리거하는 전체 UI 흐름
---

# ForTem Export Flow (게임 → NFT)

## 전체 흐름

```
[Phaser 게임에서 아이템 선택]
        ↓
[Zustand에서 walletAddress 확인]
        ↓
[/api/fortem/mint/export POST 요청]
        ↓
[서버: 원자적 잠금 → ForTem SDK 호출]
        ↓
[응답: { status: 'success', transaction_id }]
        ↓
[Zustand 인벤토리 갱신 → Phaser UI 업데이트]
```

## Phaser 씬에서 Export 호출

```typescript
import { useGameStore } from '@/lib/store/useGameStore';

export class ShopScene extends Phaser.Scene {
  async exportItem(itemId: string) {
    const { walletAddress, inventory, setInventory } = useGameStore.getState();

    if (!walletAddress) {
      this.showMessage('먼저 지갑을 연결해주세요!');
      return;
    }

    this.showMessage(`${itemId} 민팅 요청 중...`);

    try {
      const res = await fetch('/api/fortem/mint/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_user_id: 'usr_test_12345', // Phase 2에서 인증 기반으로 교체
          in_game_item_id: itemId,
          wallet_address: walletAddress,
          metadata: {
            name: `Item ${itemId}`,
            attributes: [{ trait_type: 'Attack', value: 100 }]
          }
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Export failed');
      }

      this.showMessage(`성공! TX: ${data.transaction_id}`);

      // 인벤토리 새로고침
      await this.refreshInventory();

    } catch (error: any) {
      this.showMessage(`실패: ${error.message}`);
    }
  }

  async refreshInventory() {
    const res = await fetch('/api/inventory?game_user_id=usr_test_12345');
    const data = await res.json();
    if (data.items) {
      useGameStore.getState().setInventory(data.items);
    }
  }

  showMessage(text: string) {
    // Phaser 텍스트로 메시지 표시
    if (this.messageText) this.messageText.destroy();
    this.messageText = this.add.text(400, 550, text, {
      fontSize: '16px', color: '#00ff00'
    }).setOrigin(0.5);
  }
}
```

## 아이템 카드 UI (Phaser)

```typescript
createItemCard(item: any, x: number, y: number) {
  const card = this.add.container(x, y);

  const bg = this.add.rectangle(0, 0, 150, 200, 0x2a2a4a).setStrokeStyle(2, 0x6666ff);
  const nameText = this.add.text(0, -60, item.in_game_item_id, {
    fontSize: '14px', color: '#ffffff'
  }).setOrigin(0.5);

  const statusColor = item.status === 'available' ? '#00ff00' :
                      item.status === 'mint_failed' ? '#ff4444' : '#ffaa00';
  const statusText = this.add.text(0, -30, item.status, {
    fontSize: '12px', color: statusColor
  }).setOrigin(0.5);

  card.add([bg, nameText, statusText]);

  // Export 버튼 (available 또는 mint_failed만 활성화)
  if (item.status === 'available' || item.status === 'mint_failed') {
    const btn = this.add.text(0, 60, '📤 Export', {
      fontSize: '14px', color: '#00ccff', backgroundColor: '#1a1a3e',
      padding: { x: 12, y: 6 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => this.exportItem(item.in_game_item_id));
    card.add(btn);
  }

  return card;
}
```

## 서버 응답 코드 처리

| HTTP 코드 | 의미 | UI 대응 |
|:---------:|------|---------|
| 200 | 민팅 성공 | 트랜잭션 ID 표시, 인벤토리 갱신 |
| 400 | 파라미터 오류 (지갑 주소 등) | 입력값 확인 요청 |
| 409 | 아이템 이미 처리 중 / 잠김 | "이미 처리 중입니다" 메시지 |
| 500 | 서버 오류 | "잠시 후 다시 시도해주세요" |
