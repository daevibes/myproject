# Phase 2 — 전투 시스템 설계서

> **목표:** 맵 위에 몬스터가 스폰되어 공주에게 접근하고, 플레이어가 직접 공격하여 처치하는 핵심 전투 루프 완성
> **레퍼런스:** Vampire Survivors (웨이브 압박감), Hades (히트스탑 + 넉백), HoloCure (데미지 팝업), 젤다 시리즈 (부채꼴 슬래시)

---

## 1. 플레이어 전투 스펙

| 항목 | 수치 | 근거 |
|------|:----:|------|
| HP | 100 | 러너(15뎀)에 6~7회 생존. Vampire Survivors 초반 체력 대비 유사 |
| 공격력 | 15 | 보병 2방, 러너 1방. Hades 자그레우스 초반 칼 데미지 비율 참고 |
| 공격 속도 | 0.4초 (쿨다운) | Hades 기본 검 공격 간격(0.35~0.45초)과 유사. 연타 경쾌감 |
| 이동 속도 | 220 px/s | 러너(180)보다 22% 빠름. 컨트롤로 회피 가능하되 여유롭지 않은 수준 |
| 공격 키 | **스페이스바** | |

### 1-1. 슬래시 공격 (Wide Arc Slash)

젤다 시리즈의 넓은 칼 휘두르기 + Hades의 타격감을 조합합니다.

| 항목 | 수치 | 설명 |
|------|:----:|------|
| 판정 형태 | 부채꼴 | 플레이어 전방 **120도** 호 |
| 판정 거리 | 110px | 캐릭터(32px)의 약 3.5배. 다리(400px) 너비의 약 1/4 커버 |
| 판정 방식 | 거리 + 각도 계산 | Arcade AABB 대신, `Phaser.Math.Distance` + `Phaser.Math.Angle` 사용 |
| 판정 지속 | 1프레임 (즉발) | 스페이스바 누르는 순간 범위 내 모든 적 동시 히트 |
| 방향 기준 | 마지막 이동 방향 | WASD/방향키 마지막 입력. 기본값: 아래(↓) |

**판정 로직 (핵심 알고리즘):**
```
모든 살아있는 몬스터에 대해:
  1. 플레이어 ↔ 몬스터 거리 계산
  2. 거리가 110px 이내인가?
  3. 플레이어 facing 방향 ↔ 몬스터 방향 각도차 계산
  4. 각도차가 60° 이내인가? (120° 부채꼴의 절반)
  5. 둘 다 만족하면 → 히트
```

### 1-2. 타격 피드백 (Game Juice)

Vlambeer의 "게임 주스(juice)" 원칙과 Hades의 타격감을 참고합니다.

| 효과 | 수치 | 설명 |
|------|:----:|------|
| **히트스탑** | 50ms | 적 타격 순간 씬 시간 일시정지. Hades 검 공격 히트스탑(50~80ms) 참고 |
| **넉백** | 속도 400 px/s × 0.08초 | 약 32px 밀림. 플레이어 반대 방향. 다리 밖으로 밀어내기 전략 가능 |
| **화면 흔들림** | 2px, 50ms | 타격 시 카메라 미세 진동. Hades/Gungeon 스타일 |
| **슬래시 이펙트** | 흰색 호(arc), 100ms | 공격 방향에 부채꼴 그래픽 잠깐 표시 후 소멸 |
| **몬스터 피격** | 흰색 플래시 80ms | `setTintFill(0xffffff)` → 원래 색 복귀 |
| **데미지 숫자** | 위로 떠오르며 페이드아웃 | HoloCure/Vampire Survivors 스타일. "-15" 빨간 텍스트, 0.6초간 30px 상승 후 소멸 |

### 1-3. 피격 시스템

Enter the Gungeon의 i-frame 시스템을 참고합니다.

| 항목 | 수치 | 설명 |
|------|:----:|------|
| **무적 시간 (i-frame)** | 0.5초 | 피격 후 0.5초간 데미지 면역. 보병 5마리 동시 접촉 시 즉사 방지 |
| **피격 이펙트** | 빨간 플래시 + 깜빡임 | 0.5초간 0.1초 간격으로 투명도 토글 (5회 깜빡임) |
| **접촉 데미지 주기** | 첫 접촉 즉시 + 이후 1초마다 | 몬스터가 겹쳐 있는 동안 반복 데미지 |

---

## 2. 공주 스펙

| 항목 | 수치 | 근거 |
|------|:----:|------|
| HP | 200 | 보병(5뎀) 40회, 러너(15뎀) 13회 생존. 플레이어 대응 시간 충분 |
| 이동 | 없음 (고정) | 맵 중앙 고정. 타워 디펜스의 "코어" 역할 |
| 피격 이펙트 | 빨간 깜빡임 | 플레이어와 동일 |
| 접촉 데미지 주기 | 첫 접촉 즉시 + 이후 1초마다 | |

---

## 3. 몬스터 스펙

### Type A — 보병 (Infantry)

Vampire Survivors의 일반 몹 느낌. 느리지만 물량으로 압박.

| 항목 | 수치 | 근거 |
|------|:----:|------|
| HP | 30 | 플레이어 공격력(15) × 2방 = 사망. 경쾌한 처치감 |
| 속도 | 60 px/s | 플레이어(220)의 27%. 한 마리는 무해하지만 다수가 쌓이면 위협 |
| 공격력 | 5 | 플레이어 HP(100) 기준 20회. 공주 HP(200) 기준 40회 |
| 색상 | `0xcc3333` (빨간색) | |
| 크기 | 28 × 28 px | 플레이어(32px)보다 약간 작음 |

**AI — 단일 상태:**
```
매 프레임:
  공주 방향으로 이동 (최단거리 직선)
  플레이어는 완전히 무시
```

### Type B — 러너 (Runner)

Hades의 쫓아오는 적 느낌. 빠르지만 맞으면 즉사.

| 항목 | 수치 | 근거 |
|------|:----:|------|
| HP | 10 | 플레이어 공격력(15) × 1방 = 즉사. 유리대포 |
| 속도 | 180 px/s | 플레이어(220) 대비 82%. 도망치면 겨우 벌어지는 긴장감 |
| 공격력 | 15 | 플레이어 HP(100) 기준 6~7회. 높은 위협. 우선 처치 유도 |
| 감지 범위 | 300px | 이 범위 안에 플레이어가 들어오면 타겟 전환 |
| 색상 | `0xff6600` (주황색) | 보병과 시각 구분 |
| 크기 | 24 × 24 px | 보병보다 작고 빠른 느낌 |

**AI — 2상태 FSM:**
```
상태 1: MOVE_TO_PRINCESS (기본)
  → 공주 방향으로 이동
  → 매 프레임 플레이어와의 거리 체크
  → 거리 ≤ 300px이면 → 상태 2로 전환

상태 2: CHASE_PLAYER
  → 플레이어 방향으로 이동
  → 매 프레임 플레이어와의 거리 체크
  → 거리 > 400px이면 → 상태 1로 복귀 (히스테리시스: 진입 300, 이탈 400)
```

> **히스테리시스 (300/400):** 감지 범위와 이탈 범위를 다르게 설정하여 경계선에서 상태가 계속 왔다갔다하는 문제를 방지. 실제 게임 AI의 표준 기법.

---

## 4. 밸런스 시뮬레이션

### 시나리오 A: 보병 5마리가 다리로 몰려옴
```
- 보병 5마리, 다리(400px) 위에서 밀집
- 플레이어 슬래시 범위 110px × 120° → 밀집된 2~3마리 동시 히트
- 1차 슬래시: 3마리 히트 (-15 HP → 남은 HP 15)
- 0.4초 후 2차 슬래시: 같은 3마리 히트 (-15 HP → 사망)
- 나머지 2마리도 2회 슬래시로 처치
- 총 소요: 약 1.6초. 경쾌하면서도 약간의 긴장감.
```

### 시나리오 B: 러너가 플레이어를 추격
```
- 러너 속도 180, 플레이어 속도 220 → 차이 40 px/s
- 감지 범위 300px에서 추격 시작
- 플레이어가 도망치면 초당 40px씩 벌어짐
- 7.5초 후 이탈 범위 400px 도달 → 러너가 공주로 복귀
- 또는: 돌아서서 1방에 처치 (공격 범위 110px)
- 결론: 도망 or 반격 선택지 모두 유효
```

### 시나리오 C: 보병 + 러너 혼합
```
- 보병이 공주에게 접근 중 + 러너가 플레이어를 추격
- 딜레마: 러너를 먼저 잡으면 그 사이 보병이 공주에게 도달
- 넉백으로 보병을 밀어내고 → 돌아서 러너 1방 처치 → 다시 보병 마무리
- 핵심 재미 포인트: 우선순위 판단 + 넉백 활용 전략
```

---

## 5. 테스트용 스폰 (임시)

> Phase 5(웨이브 시스템) 전까지 전투를 테스트하기 위한 임시 스폰입니다.

| 항목 | 수치 |
|------|:----:|
| 보병 스폰 간격 | 3초마다 1마리 |
| 러너 스폰 간격 | 6초마다 1마리 |
| 스폰 위치 | `mapA.spawnPoints` 4개 중 랜덤 |
| 동시 최대 몬스터 | 15마리 |
| 시작 딜레이 | 게임 시작 후 2초 뒤 첫 스폰 |

---

## 6. 파일 구조

```
game/
├── config/
│   └── constants.ts          ← 수정: 전투 상수 추가
├── entities/
│   ├── Player.ts             ← 신규: 플레이어 클래스
│   ├── Monster.ts            ← 신규: 몬스터 베이스 클래스
│   ├── Infantry.ts           ← 신규: Type A 보병
│   └── Runner.ts             ← 신규: Type B 러너
├── systems/
│   ├── CombatSystem.ts       ← 신규: 데미지, 넉백, 히트스탑, 판정
│   └── SpawnSystem.ts        ← 신규: 임시 스폰 로직
├── maps/
│   └── mapA.ts               ← 변경 없음
└── scenes/
    └── MainScene.ts          ← 수정: 엔티티 + 시스템 통합
```

### 6-1. `constants.ts` 추가 상수

```typescript
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
```

### 6-2. 핵심 구현 패턴

**부채꼴 판정 (CombatSystem):**
```typescript
isInArc(attacker: Position, target: Position, facingAngle: number, range: number, arcDeg: number): boolean {
    const dist = Phaser.Math.Distance.Between(attacker.x, attacker.y, target.x, target.y);
    if (dist > range) return false;

    const angleToTarget = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);
    const angleDiff = Phaser.Math.Angle.Wrap(angleToTarget - facingAngle);
    const halfArc = Phaser.Math.DegToRad(arcDeg / 2);

    return Math.abs(angleDiff) <= halfArc;
}
```

**히트스탑 (CombatSystem):**
```typescript
applyHitstop(scene: Phaser.Scene, durationMs: number) {
    scene.physics.pause();
    scene.time.delayedCall(durationMs, () => {
        scene.physics.resume();
    });
}
```

**넉백 (CombatSystem):**
```typescript
applyKnockback(monster: Monster, fromX: number, fromY: number) {
    const angle = Phaser.Math.Angle.Between(fromX, fromY, monster.x, monster.y);
    monster.body.setVelocity(
        Math.cos(angle) * KNOCKBACK_SPEED,
        Math.sin(angle) * KNOCKBACK_SPEED
    );
    scene.time.delayedCall(KNOCKBACK_DURATION, () => {
        monster.body.setVelocity(0);
    });
}
```

**데미지 팝업:**
```typescript
showDamagePopup(scene: Phaser.Scene, x: number, y: number, damage: number) {
    const text = scene.add.text(x, y, `-${damage}`, {
        fontSize: '16px', color: '#ff4444', fontStyle: 'bold'
    }).setOrigin(0.5);

    scene.tweens.add({
        targets: text,
        y: y - DAMAGE_POPUP_RISE,
        alpha: 0,
        duration: DAMAGE_POPUP_DURATION,
        onComplete: () => text.destroy()
    });
}
```

**러너 AI (FSM):**
```typescript
update() {
    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (this.state === 'MOVE_TO_PRINCESS' && distToPlayer <= RUNNER_DETECT_RANGE) {
        this.state = 'CHASE_PLAYER';
    } else if (this.state === 'CHASE_PLAYER' && distToPlayer > RUNNER_RELEASE_RANGE) {
        this.state = 'MOVE_TO_PRINCESS';
    }

    const target = this.state === 'CHASE_PLAYER' ? player : princess;
    this.scene.physics.moveToObject(this, target, RUNNER_SPEED);
}
```

---

## 7. 구현 순서 (개발자용)

> 아래 순서대로 구현하면 중간중간 테스트가 가능합니다.

### Step 1: 상수 업데이트 + 플레이어 리팩토링
- `constants.ts`에 위 상수 전부 추가
- `PLAYER_SPEED`를 200 → 220으로 변경
- 기존 `MainScene.ts`의 플레이어 로직을 `Player.ts` 클래스로 분리
- 스페이스바 입력 감지 추가
- **테스트:** 기존과 동일하게 이동 동작 확인

### Step 2: 슬래시 공격 판정
- `CombatSystem.ts` 생성 — `isInArc()` 함수
- 스페이스바 → 부채꼴 범위 내 적 탐색 (아직 적은 없으니 콘솔 로그로 확인)
- 슬래시 이펙트 (흰색 호) 표시
- 공격 쿨다운(0.4초) 적용
- **테스트:** 스페이스바 누르면 전방에 흰색 호가 잠깐 보이는가

### Step 3: 보병 구현
- `Monster.ts` 베이스 클래스 — HP, 색상, 크기, 피격 처리
- `Infantry.ts` — 공주 방향 직선 이동 AI
- `SpawnSystem.ts` — 3초마다 스폰 포인트에서 보병 생성
- `MainScene.ts`에 통합 — 충돌 설정
- **테스트:** 보병이 스폰되어 공주에게 이동하는가

### Step 4: 전투 연결
- 슬래시 → 보병 히트 → HP 감소 → 히트 이펙트(흰색 플래시, 데미지 숫자)
- HP 0 → 페이드아웃 후 제거
- 히트스탑(50ms) + 화면 흔들림(2px) + 넉백(32px)
- **테스트:** 보병을 2방에 처치할 수 있는가. 타격감이 있는가.

### Step 5: 접촉 데미지
- 몬스터 → 플레이어 접촉 시 데미지 + i-frame(0.5초)
- 몬스터 → 공주 접촉 시 데미지 + 쿨다운(1초)
- 플레이어/공주 HP 바 (임시, 텍스트로 표시)
- **테스트:** 보병에 맞으면 HP가 5 줄어들고, 0.5초간 무적인가

### Step 6: 러너 구현
- `Runner.ts` — 2상태 FSM (MOVE_TO_PRINCESS ↔ CHASE_PLAYER)
- 히스테리시스 적용 (진입 300px, 이탈 400px)
- 스폰 시스템에 러너 추가 (6초마다)
- **테스트:** 러너가 공주에게 가다가 플레이어 접근 시 추격하는가. 1방에 죽는가.

### Step 7: 통합 테스트
- 보병 + 러너 혼합 스폰
- 공주 HP 0 → 콘솔에 "GAME OVER" 출력 (Phase 5에서 화면 구현)
- 플레이어 HP 0 → 콘솔에 "PLAYER DEAD" 출력
- 최대 15마리 제한 동작 확인
- **테스트:** 2분간 플레이. 보병은 물량, 러너는 기습. 넉백으로 전략적 플레이 가능한가.

---

## 8. 테스트 체크리스트

파일 적용 후 `/game` 접속

**공격:**
- [ ] 스페이스바 누르면 전방에 슬래시 이펙트가 보이는가
- [ ] 0.4초 쿨다운이 적용되는가 (연타 시 일정 간격)
- [ ] 방향 전환 후 공격하면 해당 방향으로 슬래시가 나가는가

**보병:**
- [ ] 3초마다 스폰 포인트에서 빨간 사각형이 나타나는가
- [ ] 보병이 공주(초록)를 향해 직선 이동하는가
- [ ] 보병을 2방에 처치할 수 있는가
- [ ] 피격 시 흰색 플래시 + 데미지 숫자(-15)가 보이는가
- [ ] 타격 시 살짝 멈추는 느낌(히트스탑)이 있는가
- [ ] 타격 시 뒤로 밀리는가(넉백)
- [ ] HP 0이면 페이드아웃 후 사라지는가

**러너:**
- [ ] 6초마다 스폰 포인트에서 주황 사각형이 나타나는가
- [ ] 기본적으로 공주를 향해 이동하는가
- [ ] 플레이어가 300px 이내로 접근하면 플레이어를 추격하는가
- [ ] 플레이어가 400px 이상 벗어나면 다시 공주를 향하는가
- [ ] 1방에 즉사하는가

**피격:**
- [ ] 몬스터에 닿으면 플레이어 HP가 줄어드는가 (보병 -5, 러너 -15)
- [ ] 피격 후 0.5초간 깜빡이며 추가 데미지를 받지 않는가
- [ ] 몬스터가 공주에 닿으면 공주 HP가 줄어드는가
- [ ] 플레이어/공주 HP가 화면에 표시되는가 (임시 텍스트)

**스폰:**
- [ ] 동시에 15마리 이상 존재하지 않는가
- [ ] 게임 시작 후 2초 뒤에 첫 스폰이 시작되는가
