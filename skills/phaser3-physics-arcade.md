---
name: Phaser 3 Arcade Physics
description: Arcade Physics 충돌 감지, 그룹, 월드 경계 설정 패턴
---

# Phaser 3 Arcade Physics

## GameConfig 설정

```typescript
const config: Phaser.Types.Core.GameConfig = {
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 300 },  // 플랫포머: y 중력
      // gravity: { x: 0, y: 0 },  // 탑다운: 중력 없음
      debug: true, // 개발 중에는 true로 히트박스 시각화
    },
  },
};
```

## 물리 오브젝트 생성

```typescript
create() {
  // 단일 물리 스프라이트
  this.player = this.physics.add.sprite(100, 100, 'player');
  this.player.setCollideWorldBounds(true);   // 화면 밖으로 안 나감
  this.player.setBounce(0.2);                // 바닥 반동

  // 정적 그룹 (움직이지 않는 플랫폼, 벽 등)
  this.platforms = this.physics.add.staticGroup();
  this.platforms.create(400, 580, 'ground').setScale(2).refreshBody();

  // 동적 그룹 (아이템, 적 등)
  this.coins = this.physics.add.group({
    key: 'coin',
    repeat: 5,
    setXY: { x: 100, y: 0, stepX: 120 },
  });
}
```

## 충돌 감지

```typescript
create() {
  // collider: 물리적 충돌 (멈춤, 반동)
  this.physics.add.collider(this.player, this.platforms);
  this.physics.add.collider(this.coins, this.platforms);

  // overlap: 겹침 감지 (통과, 아이템 수집)
  this.physics.add.overlap(
    this.player,
    this.coins,
    this.collectCoin,  // 콜백 함수
    undefined,
    this
  );
}

collectCoin(player: any, coin: any) {
  coin.disableBody(true, true); // 비활성화 + 숨기기
  this.score += 10;
}
```

## 이동 처리

```typescript
update() {
  const cursors = this.input.keyboard!.createCursorKeys();

  // 좌우 이동
  if (cursors.left.isDown) {
    this.player.setVelocityX(-200);
  } else if (cursors.right.isDown) {
    this.player.setVelocityX(200);
  } else {
    this.player.setVelocityX(0);
  }

  // 점프 (바닥에 있을 때만)
  if (cursors.up.isDown && this.player.body.touching.down) {
    this.player.setVelocityY(-400);
  }
}
```

## 월드 경계

```typescript
create() {
  // 월드 크기 설정 (카메라 스크롤 범위)
  this.physics.world.setBounds(0, 0, 2400, 600);

  // 카메라가 플레이어 따라감
  this.cameras.main.setBounds(0, 0, 2400, 600);
  this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
}
```

## 주의사항
- `debug: true`는 개발 중에만 사용, 배포 시 반드시 `false`로
- `staticGroup`은 `setScale()` 후 반드시 `refreshBody()` 호출해야 히트박스 갱신
- `overlap`은 두 오브젝트가 겹칠 때 콜백, `collider`는 물리적으로 밀어냄
