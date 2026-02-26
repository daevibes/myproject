---
name: ForTem Status Polling
description: 민팅 요청 후 상태를 폴링하고 결과를 Phaser UI에 반영하는 패턴
---

# ForTem Status Polling

## 민팅 상태 흐름

```
available → minting_in_progress → minted (성공)
                                → mint_failed (실패 → 재시도 가능)
```

## 폴링 패턴 (Phaser 씬)

```typescript
export class ShopScene extends Phaser.Scene {
  private pollingTimer?: Phaser.Time.TimerEvent;

  // Export 요청 후 폴링 시작
  async exportAndPoll(itemId: string) {
    const res = await fetch('/api/fortem/mint/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ /* ... */ }),
    });

    const data = await res.json();
    if (res.ok) {
      this.showMessage('민팅 처리 중...');
      this.startPolling(itemId);
    }
  }

  startPolling(itemId: string) {
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // 최대 30회 (약 1분)

    this.pollingTimer = this.time.addEvent({
      delay: 2000, // 2초 간격
      callback: async () => {
        attempts++;

        const res = await fetch(`/api/inventory?game_user_id=usr_test_12345`);
        const data = await res.json();
        const item = data.items?.find((i: any) => i.in_game_item_id === itemId);

        if (!item) return;

        if (item.status === 'minted') {
          this.stopPolling();
          this.showMessage('🎉 NFT 민팅 완료!');
          this.refreshUI();
        } else if (item.status === 'mint_failed') {
          this.stopPolling();
          this.showMessage('❌ 민팅 실패. 다시 시도해주세요.');
          this.refreshUI();
        } else if (attempts >= MAX_ATTEMPTS) {
          this.stopPolling();
          this.showMessage('⏰ 시간 초과. 나중에 확인해주세요.');
        }
      },
      loop: true,
    });
  }

  stopPolling() {
    this.pollingTimer?.remove();
    this.pollingTimer = undefined;
  }

  // 씬 종료 시 폴링도 정리
  shutdown() {
    this.stopPolling();
  }
}
```

## React UI에서 폴링 (인벤토리 페이지)

```typescript
// useEffect 기반 폴링
useEffect(() => {
  if (!mintingItemId) return;

  const interval = setInterval(async () => {
    const res = await fetch(`/api/inventory?game_user_id=${TEST_USER_ID}`);
    const data = await res.json();
    const item = data.items?.find((i: any) => i.in_game_item_id === mintingItemId);

    if (item?.status === 'minted' || item?.status === 'mint_failed') {
      clearInterval(interval);
      setMintingItemId(null);
      fetchItems(); // 전체 목록 갱신
    }
  }, 2000);

  return () => clearInterval(interval);
}, [mintingItemId]);
```

## 상태별 UI 매핑

| status | Phaser UI | React UI |
|--------|-----------|----------|
| `available` | Export 버튼 활성화 | "내보내기 (Export)" |
| `minting_in_progress` | 로딩 스피너 표시 | "처리 중..." (비활성화) |
| `minted` | ✅ 완료 뱃지 | "내보내기 완료" (비활성화) |
| `mint_failed` | 🔄 재시도 버튼 | "다시 시도" (활성화) |

## 주의사항
- 폴링 간격은 2~3초가 적당 (너무 짧으면 Supabase Rate Limit에 걸림)
- 최대 시도 횟수를 설정하여 무한 폴링 방지
- 씬 전환 또는 컴포넌트 언마운트 시 반드시 폴링 정리
- 향후 Supabase Realtime으로 교체하면 폴링 없이 즉시 알림 가능
