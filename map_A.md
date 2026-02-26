# Map A 구현 — 최종 실행 명령서

> 아래 5개 파일을 그대로 복사해서 해당 경로에 붙여넣으세요.
> 기존 파일이 있으면 덮어쓰기, 없으면 새로 생성합니다.

---

## 1. `game/config/constants.ts` (신규 생성)

```typescript
export interface Position {
    x: number;
    y: number;
}

export interface Obstacle {
    x: number;
    y: number;
    w: number;
    h: number;
    color: number;
    type: 'block' | 'zone';
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

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 3200;
export const VIEWPORT_WIDTH = 720;
export const VIEWPORT_HEIGHT = 1280;
export const PLAYER_SPEED = 200;
export const PLAYER_SIZE = 32;
export const PRINCESS_SIZE = 40;
export const MINIMAP_SIZE = 160;
```

---

## 2. `game/maps/mapA.ts` (신규 생성)

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

---

## 3. `components/game/GameCanvas.tsx` (기존 파일 덮어쓰기)

```tsx
"use client";

import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { MainScene } from '@/game/scenes/MainScene';

export default function GameCanvas() {
    const gameRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && gameRef.current) {
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

            const game = new Phaser.Game(config);

            return () => {
                game.destroy(true);
            };
        }
    }, []);

    return <div ref={gameRef} className="rounded-xl overflow-hidden border-4 border-gray-800 shadow-2xl w-full h-full max-w-[720px] max-h-[1280px] mx-auto" />;
}
```

---

## 4. `game/scenes/MainScene.ts` (기존 파일 덮어쓰기)

```typescript
import * as Phaser from 'phaser';
import { mapA } from '../maps/mapA';
import {
    WORLD_WIDTH,
    WORLD_HEIGHT,
    VIEWPORT_WIDTH,
    PLAYER_SPEED,
    PLAYER_SIZE,
    PRINCESS_SIZE,
    MINIMAP_SIZE
} from '../config/constants';

export class MainScene extends Phaser.Scene {
    private player!: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: any;

    constructor() {
        super('MainScene');
    }

    create() {
        const mapData = mapA;

        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setBackgroundColor(mapData.backgroundColor);

        mapData.zones.forEach(z => {
            this.add.rectangle(z.x, z.y, z.w, z.h, z.color);
        });

        const obstacleGroup = this.physics.add.staticGroup();
        mapData.obstacles.forEach(obs => {
            const rect = this.add.rectangle(obs.x, obs.y, obs.w, obs.h, obs.color);
            obstacleGroup.add(rect);
        });

        const princess = this.add.rectangle(mapData.princess.x, mapData.princess.y, PRINCESS_SIZE, PRINCESS_SIZE, 0x00ff00);
        this.physics.add.existing(princess, true);

        const playerRect = this.add.rectangle(mapData.playerSpawn.x, mapData.playerSpawn.y, PLAYER_SIZE, PLAYER_SIZE, 0x0000ff);
        this.physics.add.existing(playerRect);
        this.player = playerRect as Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
        this.player.body.setCollideWorldBounds(true);

        mapData.spawnPoints.forEach(sp => {
            this.add.circle(sp.x, sp.y, 10, 0xff0000);
        });

        this.physics.add.collider(this.player, obstacleGroup);
        this.physics.add.collider(this.player, princess);

        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.startFollow(this.player, true, 0.05, 0.05);

        const minimapZoom = Math.min(MINIMAP_SIZE / WORLD_WIDTH, MINIMAP_SIZE / WORLD_HEIGHT);
        const minimap = this.cameras.add(VIEWPORT_WIDTH - MINIMAP_SIZE - 20, 20, MINIMAP_SIZE, MINIMAP_SIZE)
            .setZoom(minimapZoom)
            .setName('minimap');
        minimap.setBackgroundColor(0x000000);
        minimap.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        minimap.startFollow(this.player);

        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.wasd = this.input.keyboard.addKeys('W,A,S,D');
        }
    }

    update() {
        if (!this.player || !this.player.body) return;

        this.player.body.setVelocity(0);

        if (this.cursors.left.isDown || this.wasd.A.isDown) {
            this.player.body.setVelocityX(-PLAYER_SPEED);
        } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
            this.player.body.setVelocityX(PLAYER_SPEED);
        }

        if (this.cursors.up.isDown || this.wasd.W.isDown) {
            this.player.body.setVelocityY(-PLAYER_SPEED);
        } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
            this.player.body.setVelocityY(PLAYER_SPEED);
        }
    }
}
```

---

## 5. `app/game/page.tsx` (신규 생성)

```tsx
"use client";

import dynamic from 'next/dynamic';

const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center w-full h-screen bg-[#1a1a1a] text-white">Loading Game...</div>
});

export default function GamePage() {
    return (
        <main className="flex items-center justify-center w-full h-screen bg-black p-4">
            <GameCanvas />
        </main>
    );
}
```

---

## 테스트 체크리스트

파일 적용 후 `npm run dev` → `http://localhost:3000/game` 접속

- [ ] 파란 사각형(플레이어)이 화면 중앙에 보이는가
- [ ] WASD 또는 방향키로 이동되는가
- [ ] 파란 장애물(강)에 부딪혀서 통과 못하는가
- [ ] 갈색 구역(다리)은 통과되는가
- [ ] 초록 사각형(공주) 옆에서 시작하는가
- [ ] 빨간 점(스폰 포인트) 4개가 맵 모서리에 보이는가
- [ ] 우측 상단에 미니맵이 보이는가
- [ ] 맵 경계 밖으로 나갈 수 없는가
- [ ] 브라우저 크기를 바꿔도 게임 화면이 비율 유지되는가
