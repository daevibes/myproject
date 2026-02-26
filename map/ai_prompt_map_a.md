# AI 스튜디오 전달용 최종 명령서 — Map A 구현

> 이 파일의 구분선(---) 아래 내용을 그대로 복사해서 Google AI 스튜디오에 붙여넣으세요.

---

[System/Context]
우리는 Next.js 16 (App Router, TypeScript) 환경에서 **Phaser 3 (v3.90)** 을 사용하여 모바일 최적화 탑다운 서바이버 게임의 MVP를 개발 중이다.

중요: 반드시 **Phaser 3** API를 사용할 것. Phaser 4가 아님. `import Phaser from 'phaser'`로 가져오며, 현재 설치된 버전은 `"phaser": "^3.90.0"` 이다.

[기존 프로젝트 파일 구조]

이미 아래 2개 파일이 존재한다.

1. `components/game/GameCanvas.tsx` — Phaser 캔버스를 마운트하는 React 래퍼 (수정 대상)
2. `game/scenes/MainScene.ts` — Phaser Scene 클래스 (수정 대상)

현재 `components/game/GameCanvas.tsx` 코드:
```typescript
"use client";

import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { MainScene } from '@/game/scenes/MainScene';

export default function GameCanvas() {
    const gameRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && gameRef.current) {
            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.AUTO,
                parent: gameRef.current,
                width: 800,
                height: 600,
                backgroundColor: '#1a1a1a',
                scene: [MainScene],
                physics: {
                    default: 'arcade',
                    arcade: {
                        gravity: { x: 0, y: 0 }
                    }
                },
            };

            const game = new Phaser.Game(config);

            return () => {
                game.destroy(true);
            };
        }
    }, []);

    return <div ref={gameRef} className="rounded-xl overflow-hidden border-4 border-gray-800 shadow-2xl" />;
}
```

현재 `game/scenes/MainScene.ts` 코드:
```typescript
import Phaser from 'phaser';

export class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
    }

    preload() {
    }

    create() {
        this.add.text(400, 300, 'Fortem Game Start!', {
            fontSize: '48px',
            color: '#ffffff'
        }).setOrigin(0.5);
    }
}
```

[Task]
아래 Map A 설계도와 코드 구조를 바탕으로, 총 **5개 파일**을 출력하라.

기존 파일 수정 (2개):
- `components/game/GameCanvas.tsx` — config 변경 (해상도 720x1280, scale, physics)
- `game/scenes/MainScene.ts` — 맵 데이터를 import하여 오브젝트를 동적 배치하는 Scene 로직

신규 생성 (3개):
- `game/config/constants.ts` — 공통 상수 + MapData 타입 정의
- `game/maps/mapA.ts` — Map A 오브젝트 좌표/설정 데이터
- `app/game/page.tsx` — next/dynamic으로 GameCanvas를 클라이언트에서만 로드

[설계 원칙: 맵 데이터 분리]

이 게임은 나중에 맵이 여러 개 추가된다. 따라서:
- 공통 상수와 타입은 `game/config/constants.ts`에 정의
- 개별 맵 데이터는 `game/maps/mapA.ts` 형태로 분리
- `MainScene.ts`는 **맵 데이터 객체를 import하여 동적으로 오브젝트를 배치**해야 함
- 나중에 `mapB.ts`, `mapC.ts`를 추가하면 `MainScene.ts` 수정 없이 맵을 교체할 수 있어야 함

목표 파일 구조:
```
game/
├── config/
│   └── constants.ts         ← 공통 상수 + MapData/Position/Obstacle 타입
├── maps/
│   └── mapA.ts              ← Map A 데이터 (좌표, 색상, 오브젝트 목록)
└── scenes/
    └── MainScene.ts         ← mapA를 import → 루프 돌면서 오브젝트 생성

components/game/
└── GameCanvas.tsx           ← Phaser config (720x1280, Scale.FIT)

app/game/
└── page.tsx                 ← next/dynamic SSR 방어
```

[요구 사항 및 구현 원칙]

1. **Phaser 3 (v3.90) API만 사용할 것.** Phaser 4 API를 절대 쓰지 마라.

2. **game/config/constants.ts:**
   아래 타입과 상수를 정의할 것.

   ```typescript
   // 타입
   export interface Position { x: number; y: number; }

   export interface Obstacle {
       x: number;       // 사각형 중심 좌표
       y: number;       // 사각형 중심 좌표
       w: number;
       h: number;
       color: number;   // hex (예: 0x2244aa)
       type: 'block' | 'zone';  // block=충돌, zone=통과가능
   }

   export interface MapData {
       name: string;
       backgroundColor: number;
       princess: Position;
       playerSpawn: Position;
       obstacles: Obstacle[];
       zones: Obstacle[];
       spawnPoints: Position[];
   }

   // 공통 상수
   export const WORLD_WIDTH = 2400;
   export const WORLD_HEIGHT = 3200;
   export const VIEWPORT_WIDTH = 720;
   export const VIEWPORT_HEIGHT = 1280;
   export const PLAYER_SPEED = 200;
   export const PLAYER_SIZE = 32;
   export const PRINCESS_SIZE = 40;
   export const MINIMAP_SIZE = 160;
   ```

3. **game/maps/mapA.ts:**
   Map A 데이터를 아래와 같이 정의할 것.

   ```typescript
   import { MapData } from '../config/constants';

   export const mapA: MapData = {
       name: 'Map A: River Crossing',
       backgroundColor: 0x2d2d2d,
       princess: { x: 1200, y: 800 },
       playerSpawn: { x: 1200, y: 850 },
       obstacles: [
           { x: 500, y: 1600, w: 1000, h: 200, color: 0x2244aa, type: 'block' },
           { x: 1900, y: 1600, w: 1000, h: 200, color: 0x2244aa, type: 'block' },
       ],
       zones: [
           { x: 1200, y: 1600, w: 400, h: 200, color: 0x8B4513, type: 'zone' },
       ],
       spawnPoints: [
           { x: 200, y: 200 },
           { x: 2200, y: 200 },
           { x: 200, y: 3000 },
           { x: 2200, y: 3000 },
       ],
   };
   ```

4. **components/game/GameCanvas.tsx 수정:**
   기존 config를 아래로 교체. `width: 800, height: 600`을 반드시 제거할 것.

   ```typescript
   const config: Phaser.Types.Core.GameConfig = {
       type: Phaser.AUTO,
       parent: gameRef.current,
       scale: {
           mode: Phaser.Scale.FIT,
           autoCenter: Phaser.Scale.CENTER_BOTH,
           width: 720,
           height: 1280,
       },
       backgroundColor: '#2d2d2d',
       scene: [MainScene],
       physics: {
           default: 'arcade',
           arcade: {
               gravity: { x: 0, y: 0 },
           }
       },
   };
   ```

5. **game/scenes/MainScene.ts 수정:**

   핵심 구조:
   - `mapA` 데이터를 import
   - `constants.ts`에서 공통 상수를 import
   - `create()`에서 맵 데이터를 루프 돌면서 오브젝트를 동적 생성
   - 하드코딩된 좌표를 쓰지 말고 반드시 맵 데이터 객체의 값을 참조할 것

   create() 메서드에서 해야 할 일 (순서대로):

   a) **물리 월드 바운드 설정:**
      `this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)`

   b) **zones 배치 (통과 가능 구역 — 다리 등):**
      `mapData.zones`를 루프 돌면서 `this.add.rectangle(z.x, z.y, z.w, z.h, z.color)` 생성. 물리 바디 불필요.

   c) **obstacles 배치 (통과 불가 장애물 — 강 등):**
      `mapData.obstacles`를 루프 돌면서 사각형 생성 후 `this.physics.add.existing(rect, true)` (true = static body). 나중에 플레이어와 collider 연결.

   d) **공주(Princess) 배치:**
      `mapData.princess` 좌표에 녹색 사각형(PRINCESS_SIZE x PRINCESS_SIZE) 생성. `this.physics.add.existing(princess, true)` + `setImmovable(true)`.

   e) **플레이어(Player) 배치:**
      `mapData.playerSpawn` 좌표에 파란색 사각형(PLAYER_SIZE x PLAYER_SIZE) 생성. `this.physics.add.existing(player)` (dynamic body). `setCollideWorldBounds(true)` 적용.

   f) **스폰 포인트 마커 (디버그용):**
      `mapData.spawnPoints`를 루프 돌면서 `this.add.circle(sp.x, sp.y, 10, 0xff0000)` 생성. 물리 바디 불필요.

   g) **충돌(Collider) 설정:**
      - 플레이어 vs 각 obstacle: `this.physics.add.collider(player, obstacleRect)`
      - 플레이어 vs 공주: `this.physics.add.collider(player, princess)`

   h) **카메라 설정:**
      메인 카메라:
      - `this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)`
      - `this.cameras.main.startFollow(player, true, 0.05, 0.05)`

      미니맵 카메라:
      - `this.cameras.add()` 로 우측 상단에 MINIMAP_SIZE x MINIMAP_SIZE 크기 생성
      - `setZoom`으로 월드 전체가 보이도록 축소 (MINIMAP_SIZE / WORLD_WIDTH 비율)
      - 미니맵 배경색을 약간 어둡게 처리
      - 미니맵도 플레이어를 startFollow

   i) **키보드 입력 설정:**
      ```typescript
      this.cursors = this.input.keyboard!.createCursorKeys();
      this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as any;
      ```

   update() 메서드:
   ```typescript
   player.setVelocity(0);
   if (this.cursors.left.isDown || this.wasd.A.isDown) player.setVelocityX(-PLAYER_SPEED);
   if (this.cursors.right.isDown || this.wasd.D.isDown) player.setVelocityX(PLAYER_SPEED);
   if (this.cursors.up.isDown || this.wasd.W.isDown) player.setVelocityY(-PLAYER_SPEED);
   if (this.cursors.down.isDown || this.wasd.S.isDown) player.setVelocityY(PLAYER_SPEED);
   ```

6. **app/game/page.tsx 생성:**
   `next/dynamic`으로 GameCanvas를 SSR 없이 로드.
   ```typescript
   import dynamic from 'next/dynamic';
   const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), { ssr: false });
   ```
   페이지는 간단하게 GameCanvas를 중앙에 배치. 배경은 어두운 색.

[Output]
아래 5개 파일의 **전체 코드**를 출력하라. 각 파일은 복사해서 바로 붙여넣기 가능하도록 완전한 코드로 출력할 것.

1. `game/config/constants.ts` — 신규 생성
2. `game/maps/mapA.ts` — 신규 생성
3. `components/game/GameCanvas.tsx` — 기존 파일 수정본
4. `game/scenes/MainScene.ts` — 기존 파일 수정본
5. `app/game/page.tsx` — 신규 생성

Phaser 3 API만 사용했는지 반드시 확인하고, `import Phaser from 'phaser'` 형태의 import를 유지할 것.
MainScene.ts에서 오브젝트 좌표를 하드코딩하지 말고, 반드시 mapA 데이터 객체의 값을 참조할 것.
