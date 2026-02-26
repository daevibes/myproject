---
name: Phaser 3 Asset Loading
description: 이미지, 스프라이트시트, 오디오 로딩 및 로딩 화면 구현 패턴
---

# Phaser 3 Asset Loading

## 기본 에셋 로딩 (preload)

```typescript
preload() {
  // 이미지
  this.load.image('background', '/assets/images/bg.png');
  this.load.image('sword', '/assets/images/sword.png');

  // 스프라이트시트 (캐릭터 애니메이션 등)
  this.load.spritesheet('player', '/assets/sprites/player.png', {
    frameWidth: 64,
    frameHeight: 64,
  });

  // 오디오
  this.load.audio('bgm', '/assets/audio/bgm.mp3');
  this.load.audio('click', '/assets/audio/click.wav');

  // JSON 데이터 (아이템 정보, 맵 데이터 등)
  this.load.json('itemData', '/assets/data/items.json');
}
```

## 로딩 화면 (BootScene 패턴)

```typescript
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // 로딩 바 UI
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 15, 320, 30);

    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      fontSize: '20px', color: '#ffffff'
    }).setOrigin(0.5);

    const percentText = this.add.text(width / 2, height / 2, '0%', {
      fontSize: '16px', color: '#ffffff'
    }).setOrigin(0.5);

    // 진행률 이벤트
    this.load.on('progress', (value: number) => {
      percentText.setText(`${Math.floor(value * 100)}%`);
      progressBar.clear();
      progressBar.fillStyle(0x00ff00, 1);
      progressBar.fillRect(width / 2 - 155, height / 2 - 10, 310 * value, 20);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
    });

    // 여기에 모든 에셋 로드
    this.load.image('background', '/assets/images/bg.png');
    // ...
  }

  create() {
    this.scene.start('MainMenuScene');
  }
}
```

## 에셋 폴더 구조

```
public/
└── assets/
    ├── images/        # 배경, UI 아이콘
    ├── sprites/       # 캐릭터/아이템 스프라이트시트
    ├── audio/         # BGM, 효과음
    ├── tilemaps/      # 타일맵 JSON
    └── data/          # 아이템/스테이지 설정 JSON
```

## 주의사항
- Next.js에서는 에셋을 `public/` 폴더에 배치하고 `/assets/...`로 참조
- 대용량 에셋은 `BootScene`에서 한 번에 로딩하고, 이후 씬에서는 캐시 사용
- 스프라이트시트의 `frameWidth`/`frameHeight`가 실제 이미지와 안 맞으면 렌더링 깨짐
