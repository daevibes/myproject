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
export const INFANTRY_SPEED = 130;
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

// === Phase 5: 웨이브 상수 ===
export const WAVE_REST_TIME = 3000;          // ms (웨이브 간 대기)
export const WAVE_HP_SCALE = 0.10;           // 웨이브당 HP +10%
export const WAVE_SPEED_SCALE = 0.08;        // 웨이브당 Speed +8%
export const VICTORY_BONUS_POINTS = 50;
export const SPAWN_MAX_MONSTERS = 100;

// === Phase 5: 스킬 게이지 ===
export const SKILL_GAUGE_PER_HIT = 2;        // 적중당 +2%
export const SKILL_GAUGE_MAX = 100;

// === Phase 5: 전투 입력 ===
export const ATTACK_HOLD_INTERVAL = 400;     // 홀드 자동공격 간격(ms)

// === Phase 5: 보스 / 챕터 ===
export const BOSS_WAVE_INTERVAL = 8;         // 8의 배수마다 보스
export const BOSS_CHAPTER_HP_SCALE = 1.5;   // 챕터당 보스 HP 배율
export const BOSS_CHAPTER_ATK_SCALE = 1.3;  // 챕터당 보스 ATK 배율
export const CHAPTER_MON_HP_SCALE = 1.5;    // 챕터당 일반 몬스터 HP 배율
export const CHAPTER_MON_ATK_SCALE = 1.3;   // 챕터당 일반 몬스터 ATK 배율

// === Phase 3: 아이템 상수 ===
export const INVENTORY_MAX_SLOTS = 20;
export const ITEM_DROP_SIZE = 20;            // px
export const ITEM_PICKUP_RANGE = 50;         // px
export const ITEM_POPUP_DURATION = 800;      // ms
export const BURN_POINT_REWARD = 10;

// === Phase 5: DEF 최소 데미지 보정 ===
export const MIN_DAMAGE_RATIO = 0.15;        // 원래 공격력의 최소 15%

// === Phase 5: 몬스터 이속 Hard Cap ===
export const MONSTER_SPEED_SCALE_CAP = 1.5;  // speedScale 최대치

// === Phase 5: 체력 구슬 ===
export const HEAL_ORB_DROP_CHANCE = 0.04;    // 4% 확률
export const HEAL_ORB_HEAL_RATIO = 0.05;     // maxHp의 5% 회복
export const HEAL_ORB_SIZE = 14;             // px
export const HEAL_ORB_DURATION = 8000;       // 8초 후 소멸
