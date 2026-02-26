# Map Design Specification

> **목적:** 모든 맵이 따라야 할 공통 규칙 + 개별 맵 설계를 정의
> **원칙:** 같은 크기, 다른 특색. MVP에서는 Map A 1개만 구현.
> **Phaser 버전:** Phaser 3 (v3.90) — Phaser 4 아님

---

## Part 1. 공통 규칙 (모든 맵에 적용)

### 1.1 월드 크기 (고정)

| 항목 | 값 | 비고 |
|------|-----|------|
| 뷰포트 (화면) | 720 x 1280 | 모바일 세로형 |
| 물리 월드 | 2400 x 3200 | 모든 맵 동일 크기 |
| Scale 모드 | FIT + CENTER_BOTH | 브라우저 크기에 맞춤 |

### 1.2 카메라 (고정)

| 항목 | 설정 |
|------|------|
| 메인 카메라 | 플레이어 추적, Lerp 0.05, 월드 바운드 (0, 0, 2400, 3200) |
| 미니맵 | 우측 상단 160x160, 월드 전체 보기, 어두운 배경 |

### 1.3 플레이어 (고정)

| 항목 | 값 |
|------|-----|
| 크기 | 32 x 32 (파란색 0x4444ff placeholder) |
| 이동 속도 | 200 |
| 조작 | WASD + 방향키 |
| 충돌 | 월드 바운드 + 장애물 (block 타입) |
| 스폰 위치 | 맵마다 다름 (각 맵 데이터에서 정의) |

### 1.4 공주 (고정)

| 항목 | 값 |
|------|-----|
| 크기 | 40 x 40 (녹색 0x00ff00 placeholder) |
| 물리 | setImmovable(true), 밀림 방지 |
| 위치 | 맵마다 다름 (각 맵 데이터에서 정의) |

### 1.5 적(몬스터) 스폰 포인트 (고정 규칙)

| 항목 | 값 |
|------|-----|
| 개수 | 맵당 4개 |
| 배치 원칙 | 월드 네 모서리 근처 |
| 시각 표시 | 빨간 원 (r=10, 0xff0000), 디버그용 마커 |
| 좌표 | 맵마다 다름 (각 맵 데이터에서 정의) |

### 1.6 맵 데이터 형식 (MapData 타입)

모든 맵 파일은 아래 타입을 따릅니다. 이 타입은 `game/config/constants.ts`에 정의됩니다.

```typescript
interface Position { x: number; y: number; }

interface Obstacle {
    x: number;       // 중심 좌표
    y: number;       // 중심 좌표
    w: number;
    h: number;
    color: number;   // hex color (예: 0x2244aa)
    type: 'block' | 'zone';  // block=통과불가, zone=통과가능(시각 표시만)
}

interface MapData {
    name: string;
    backgroundColor: number;
    princess: Position;
    playerSpawn: Position;
    obstacles: Obstacle[];
    zones: Obstacle[];
    spawnPoints: Position[];
}
```

---

## Part 2. Map A — 강과 다리 (MVP)

### 2.1 테마

강으로 남북이 나뉘고, 중앙 다리로만 이동 가능한 맵.
공주는 북쪽 중앙, 적은 네 모서리에서 스폰.

### 2.2 배치도

```
(0,0)───────────────────────────────────(2400,0)
│                                              │
│  [스폰NW]                      [스폰NE]      │
│  (200,200)                     (2200,200)    │
│                                              │
│              [공주] (1200,800)                │
│              [플레이어] (1200,850)            │
│                                              │
│                                              │
│  ████ 강(좌) ████  ▓다리▓  ████ 강(우) ████  │
│  (500,1600)       (1200,   (1900,1600)       │
│  1000x200         1600)    1000x200          │
│                   400x200                    │
│                                              │
│                                              │
│  [스폰SW]                      [스폰SE]      │
│  (200,3000)                    (2200,3000)   │
│                                              │
(0,3200)───────────────────────────────(2400,3200)
```

### 2.3 오브젝트 상세

| 오브젝트 | 중심좌표 (x,y) | 크기 (w x h) | 색상 | 타입 |
|---------|:---------:|:---------:|------|:----:|
| 공주 | 1200, 800 | 40 x 40 | 0x00ff00 | 고정 |
| 플레이어 | 1200, 850 | 32 x 32 | 0x4444ff | 고정 |
| 강 (좌) | 500, 1600 | 1000 x 200 | 0x2244aa | block |
| 강 (우) | 1900, 1600 | 1000 x 200 | 0x2244aa | block |
| 다리 | 1200, 1600 | 400 x 200 | 0x8B4513 | zone |
| 스폰 NW | 200, 200 | r=10 | 0xff0000 | 마커 |
| 스폰 NE | 2200, 200 | r=10 | 0xff0000 | 마커 |
| 스폰 SW | 200, 3000 | r=10 | 0xff0000 | 마커 |
| 스폰 SE | 2200, 3000 | r=10 | 0xff0000 | 마커 |

### 2.4 맵 A 특수 규칙

- 남북 이동은 반드시 다리(중앙 400px 구간)를 통해서만 가능
- 강 양쪽 끝은 월드 벽과 맞닿아야 함 (틈 없이 막음)
- 다리 위에서는 속도 변화 없음 (MVP에서는 단순 통과)

### 2.5 맵 데이터 파일 (`game/maps/mapA.ts`)

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

## Part 3. 코드 구조

### 3.1 MVP 구조 (맵 1개)

```
game/
├── config/
│   └── constants.ts         ← 공통 상수 + MapData 타입
├── maps/
│   └── mapA.ts              ← Map A 오브젝트 좌표/설정 데이터
└── scenes/
    └── MainScene.ts         ← Scene 로직 (맵 데이터를 읽어서 배치)

components/
└── game/
    └── GameCanvas.tsx       ← Phaser config + React 래퍼

app/
└── game/
    └── page.tsx             ← next/dynamic으로 GameCanvas 로드
```

### 3.2 나중에 맵 추가 시 (Post-MVP)

```
game/maps/ 에 mapB.ts, mapC.ts 추가만 하면 됨.
MainScene.ts는 수정 불필요 (맵 데이터를 동적으로 읽으므로).
```

---

## Part 4. 개발 순서

| 순서 | 작업 | 파일 | 완료 기준 |
|:----:|------|------|----------|
| 1 | 공통 상수 + 타입 | `game/config/constants.ts` | 월드 크기, 속도, MapData 타입 정의 |
| 2 | Map A 데이터 | `game/maps/mapA.ts` | 오브젝트 좌표 + 색상 데이터 |
| 3 | GameCanvas config 수정 | `components/game/GameCanvas.tsx` | 720x1280, Scale.FIT 적용 |
| 4 | MainScene 맵 로직 | `game/scenes/MainScene.ts` | mapA 데이터 읽기 + 오브젝트 배치 + 카메라 + 입력 |
| 5 | 게임 페이지 생성 | `app/game/page.tsx` | /game 접속 시 게임 화면 렌더링 |
| 6 | 동작 확인 | 브라우저 | 캐릭터 이동, 강 충돌, 다리 통과, 미니맵 확인 |
