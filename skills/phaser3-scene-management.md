---
name: Phaser 3 Scene Management
description: Phaser 3 씬 생성, 전환, 데이터 전달 패턴
---

# Phaser 3 Scene Management

## 씬 생성 기본 구조

```typescript
import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene'); // 고유 키
  }

  init(data?: any) {
    // 다른 씬에서 전달받은 데이터 수신
    this.selectedItem = data?.item;
  }

  preload() {
    // 에셋 로드
  }

  create() {
    // 게임 오브젝트 생성
  }

  update(time: number, delta: number) {
    // 매 프레임 실행
  }
}
```

## 씬 전환 패턴

```typescript
// 현재 씬 종료 → 새 씬 시작
this.scene.start('ShopScene', { coins: 100 });

// 현재 씬 유지 + 위에 새 씬 겹침 (UI 오버레이용)
this.scene.launch('InventoryOverlay');

// 씬 일시 정지 / 재개
this.scene.sleep('GameScene');
this.scene.wake('GameScene');

// 씬 중단 (완전 정지, update 안 돌아감)
this.scene.pause('GameScene');
this.scene.resume('GameScene');
```

## 씬 간 데이터 전달

```typescript
// 방법 1: start/launch 시 data 객체 전달
this.scene.start('ResultScene', { score: 1500, items: ['sword_lv3'] });

// 방법 2: Registry (전역 데이터 저장소)
this.registry.set('playerHP', 100);
const hp = this.registry.get('playerHP');

// 방법 3: Events (씬 간 메시지)
this.scene.get('GameScene').events.emit('item-collected', itemData);
this.events.on('item-collected', (data) => { /* 처리 */ });
```

## GameConfig에 씬 등록

```typescript
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  scene: [BootScene, MainMenuScene, GameScene, ShopScene],
};
```

## 주의사항
- `scene.start()`는 현재 씬을 **종료**하므로, 상태를 유지하려면 `sleep/wake` 사용
- `init()`은 씬이 시작될 때마다 호출되므로, 초기화 로직은 여기에 배치
- 씬 키는 프로젝트 내에서 **고유**해야 함
