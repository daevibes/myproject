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
export const VIEWPORT_WIDTH = 1280;
export const VIEWPORT_HEIGHT = 720;
export const PLAYER_SIZE = 32;
export const PRINCESS_SIZE = 40;
export const MINIMAP_SIZE = 160;

// === Phase 2: 전투 상수 ===

// 플레이어
export const PLAYER_HP = 100;
export const PLAYER_ATK = 15;
export const PLAYER_ATK_COOLDOWN = 400;    // ms
export const PLAYER_ATK_RANGE = 110;       // px
export const PLAYER_ATK_ARC = 120;         // 도(degree)
export const PLAYER_IFRAME = 500;          // ms
export const PLAYER_SPEED = 220;           // 기존 200에서 변경

// 공주
export const PRINCESS_HP = 200;

// 히트 이펙트
export const HITSTOP_DURATION = 50;        // ms
export const KNOCKBACK_SPEED = 400;        // px/s
export const KNOCKBACK_DURATION = 80;      // ms
export const SCREEN_SHAKE_INTENSITY = 2;   // px
export const SCREEN_SHAKE_DURATION = 50;   // ms
export const DAMAGE_POPUP_DURATION = 600;  // ms
export const DAMAGE_POPUP_RISE = 30;       // px

// 접촉 데미지
export const CONTACT_DAMAGE_INTERVAL = 1000; // ms

// 몬스터 공통
export const MONSTER_FLASH_DURATION = 80;  // ms

// 보병 (Type A)
export const INFANTRY_HP = 30;
export const INFANTRY_SPEED = 60;
export const INFANTRY_ATK = 5;
export const INFANTRY_SIZE = 28;
export const INFANTRY_COLOR = 0xcc3333;

// 러너 (Type B)
export const RUNNER_HP = 10;
export const RUNNER_SPEED = 180;
export const RUNNER_ATK = 15;
export const RUNNER_SIZE = 24;
export const RUNNER_COLOR = 0xff6600;
export const RUNNER_DETECT_RANGE = 300;    // px (추격 시작)
export const RUNNER_RELEASE_RANGE = 400;   // px (추격 해제, 히스테리시스)

// 테스트 스폰
export const SPAWN_INTERVAL_INFANTRY = 3000; // ms
export const SPAWN_INTERVAL_RUNNER = 6000;   // ms
export const SPAWN_MAX_MONSTERS = 15;
export const SPAWN_START_DELAY = 2000;       // ms
