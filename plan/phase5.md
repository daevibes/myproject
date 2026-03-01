# Phase 5: 8-Wave 코어 루프 & 타격 시스템 & 11보스 전면 개편 — 구현 완료

## 확정 사항
- 공격: 마우스 클릭/홀드, 모바일 우측하단 온스크린 버튼 2개
- 보스: 11마리 전체 완전 기믹 구현
- 스킬 게이지: 웨이브 간 누적, 스킬 발동 시 0% 리셋, 보스 처치 시 100% 충전
- 방패: LeftHand 슬롯 장착, weaponType 없음(방어구 취급) → 검+방패 = MegaSwordBeam

## 세이브 정책
- ✅ Game Over 시 flushAndSave
- ✅ 보스 처치(여신의 가호) 시 flushAndSave
- ❌ ESC 종료 시 저장 없음 (아이템 증발)

---

## 수정/생성 파일 전체 목록 (14개)

### 1. `game/config/items.ts` ✅
- `EquipSlotId` = `'Head' | 'Body' | 'Legs' | 'Shoes' | 'RightHand' | 'LeftHand'`
- `WeaponType` = `'Sword' | 'Spear'` (Shield 제외 — 방어구 취급)
- `ItemDef` 인터페이스에 `defBonus`, `speedBonus`, `isTwoHanded` 추가
- 18개 아이템 정의 (sword 3종, spear 2종, offhand_sword 2종, shield 3종, helm 2종, body 3종, legs 1종, boots 2종)
- `EQUIP_SLOTS` 배열, `RARITY_COLORS` 상수 추가

### 2. `game/config/constants.ts` ✅
- Phase 5 웨이브 상수: `WAVE_REST_TIME`, `WAVE_HP_SCALE`, `WAVE_SPEED_SCALE`
- 스킬 게이지 상수: `SKILL_GAUGE_PER_HIT`(2%), `SKILL_GAUGE_MAX`(100)
- 전투 입력 상수: `ATTACK_HOLD_INTERVAL`(400ms 홀드 공격 간격)
- 보스/챕터 상수: `BOSS_WAVE_INTERVAL`(8), `BOSS_CHAPTER_HP_SCALE`, `BOSS_CHAPTER_ATK_SCALE`, `CHAPTER_MON_HP_SCALE`, `CHAPTER_MON_ATK_SCALE`

### 3. `game/config/dropTable.ts` ✅
- `DROP_CHANCE` = 0.4 (40% 드롭 확률)
- 18종 아이템 가중치 테이블 (`DROP_TABLE`)
- `rollDrop()` 함수: 가중치 기반 랜덤 드롭 반환

### 4. `lib/store/useGameStore.ts` ✅
- `STORE_VERSION` 5로 상향 (구버전 localStorage 강제 초기화)
- `equipped` 구조를 `Record<EquipSlotId, OwnedItem | null>` 객체로 마이그레이션 (기존 배열 → 6슬롯 맵)
- `skillGauge: number` (0~100) 상태 추가
- `addSkillGauge(pct)`, `setSkillGauge(val)` 액션 추가
- `equip()`: 양손 무기(`isTwoHanded`) 장착 시 RightHand + LeftHand 동시 점유 로직
- `unequip()`: 양손 무기 해제 시 두 슬롯 동시 비움
- `migrate()`: 구버전 equipped 구조를 6슬롯 DEFAULT_EQUIPPED로 초기화

### 5. `game/systems/WaveManager.ts` ✅
**8-Wave 챕터 루프**
- Wave 1~3: Infantry 소량 (탐색전)
- Wave 4: Elite 1~2마리 확정 스폰
- Wave 5~7: 물량 2배 호드 러시
- Wave 8: 챕터 보스 확정 스폰 + 소수 일반 몬스터

**챕터 스케일링**
- 챕터마다 일반 몬스터 HP ×1.5, ATK ×1.3
- 챕터마다 보스 HP ×1.5, ATK ×1.3 (지수 누적)
- 웨이브마다 HP +10%, Speed +5% 누적

**이벤트**
- `boss-died`: 보스 사망 → `bossAlive = false` → 웨이브 종료 체크
- `wave-clear`, `boss-wave-clear` 이벤트 emit
- 카운트다운 텍스트: 보스 웨이브 전 빨간색, 일반 웨이브 노란색

### 6. `game/entities/Boss.ts` ✅ (신규)
**11마리 보스 `BOSS_CONFIGS` 정의**

| bossIndex | 이름 | 기믹 |
|-----------|------|------|
| 0 | 오크 대장 | charge (직선 돌격) |
| 1 | 독 거미 여왕 | web_slow (거미줄 투사체) |
| 2 | 해골 기사 | revive (HP50%로 1회 부활) |
| 3 | 피의 골렘 | hp_regen (초당 maxHp×2% 회복) |
| 4 | 그림자 암살자 | blink (플레이어 근처 순간이동) |
| 5 | 불꽃 술사 | fire_zone (화염장판 생성) |
| 6 | 미노타우로스 | dash (2초 캐스팅 후 고속 돌진) |
| 7 | 타락한 드래곤 | breath (100도 부채꼴 브레스) |
| 8 | 빙결 마법사 | frost_slow (플레이어 이속/공속 50% 감소, 2초) |
| 9 | 심연 악마 | summon (소형 악마 2마리 소환) |
| 10 | 혼돈의 화신 | multi_phase (P1: charge / P2: charge+fire_zone) |

**기타 구현**
- 보스 이름 라벨 + HP 바 (머리 위 상시 표시, 위치 동기화)
- `revive`: 최초 1회 HP50% 부활
- `hp_regen`: Phaser 타이머로 초당 회복
- `multi_phase`: HP 50% 이하 시 `PHASE 2!` 배너 + 색상 변경 + fire_zone 추가
- 사망 시 `boss-died` 이벤트 emit

### 7. `game/entities/WebProjectile.ts` ✅ (신규)
- `WebProjectile extends Phaser.GameObjects.Arc`
- 속도 180px/s, 반경 10px, 수명 4초
- 플레이어 충돌 시 이속 50% 감소 디버프 3초 적용
- 히트 후 페이드 아웃 소멸

### 8. `game/entities/FireZone.ts` ✅ (신규)
- `FireZone extends Phaser.GameObjects.Rectangle` (80×80px, 주황색)
- 지속 5초, 700ms 틱마다 데미지 8
- 깜빡임 tween 애니메이션
- `isInvincible` 판정으로 무적 프레임 중 데미지 차단

### 9. `game/entities/Player.ts` ✅
- 생성자에서 6슬롯 `equipped` 전체 순회해 `hpBonus`, `atkBonus`, `defBonus`, `speedBonus` 합산
- `slowMultiplier: number` (이속 배율, 보스 기믹 디버프용)
- `atkCooldownMultiplier: number` (공속 쿨다운 배율)
- `takeDamage()`: `Math.max(1, amount - defBonus)`로 방어력 반영
- `handleMovement()`: `(PLAYER_SPEED + speedBonus) * slowMultiplier` 반영

### 10. `game/systems/CombatSystem.ts` ✅
- `performAttack()`: 히트 수(`hitCount`) 반환 (스킬 게이지 연동용)
- `castUltimate(type, player, monsters)`: 3종 궁극기 분기
  - `CircleShockwave`: 반경 200px, ATK×3, 강한 넉백
  - `MegaSwordBeam`: 길이 500px, 폭 30px 관통 광선, ATK×4
  - `Whirlwind`: 3초간 반경 130px 회전 연속 타격, 틱당 ATK×0.8 (300ms 간격)
- `distPointToSegment()`: 광선 판정용 점-선분 거리 계산

### 11. `game/scenes/MainScene.ts` ✅
**투버튼 입력 시스템**
- 좌클릭/포인터다운: 즉시 공격 1회 + 홀드 시 400ms 간격 연속 공격
- 우클릭: 궁극기 발동
- 온스크린 버튼 2개 (공격 / 스킬): 모바일/터치 지원
- `isOverHudButton()`: HUD 영역 클릭 시 월드 공격 차단

**스킬 게이지 & 궁극기**
- 평타 명중마다 `hitCount × 2%` 충전
- `getUltimateType()`: 장비 조합으로 궁극기 종류 결정 (Spear → CircleShockwave / 쌍검 → Whirlwind / 한손검 → MegaSwordBeam)
- 게이지 100% + 무기 있을 때 스킬 버튼 활성화

**여신의 가호 (보스 처치 보상)**
- `boss-wave-clear` 이벤트 수신
- 플레이어 HP 100% 회복
- 스킬 게이지 100% 충전
- `flushAndSave()` 호출 (중간 세이브)
- 골드 오버레이 + 배너 이펙트

**보스 기믹 이벤트 수신**
- `boss-web-projectile`: WebProjectile 생성
- `boss-fire-zone`: FireZone 생성
- `boss-breath`: 브레스 부채꼴 피격 판정
- `boss-summon`: 소형 악마 2마리 스폰

**ESC 종료 정책**
- 일시정지 메뉴의 종료 버튼: **저장 없이** 로비 이동 (아이템 증발)
- 버튼 라벨 `종료 (아이템 미저장)`으로 명시

### 12. `game/scenes/LobbyScene.ts` ✅
- 6슬롯 장비창 (2행 × 3열 그리드): Head / Body / Legs / Shoes / RightHand / LeftHand
- 양손 무기 LeftHand 점유 시 `[양손 점유]` 텍스트 표시
- 슬롯별 스탯 요약 (ATK/DEF/HP/SPD 보너스)
- 총 스탯 표시 (기본 + 전 슬롯 합산)
- 인벤토리 아이템 그룹화 표시 (같은 itemId는 묶어서 `xN` 표기)
- 장착/해제/소각 액션 패널

### 13. `app/inventory/page.tsx` ✅
- `isExportable: true` 아이템만 NFT 후보로 표시
- `ExportGroup`: 같은 `in_game_item_id` 묶음 + 장착 제외 내보내기 가능 수 계산
- 수량 선택 UI (2개 이상 보유 시 노출): ±버튼, 숫자 입력, 전체 선택
- DB 현황 (`dbGroups`): 상태별 카운트 (대기/민팅중/완료/실패)
- 실패 항목 재시도 버튼 (`mint_failed` → re-export)

### 14. `app/api/webhook/fortem/route.ts` ✅ (신규)
**ForTem 비동기 민팅 결과 콜백 수신 엔드포인트**
- HMAC-SHA256 서명 검증 (`x-fortem-signature` 헤더)
- Replay 공격 방어: `x-fortem-timestamp` ±5분 허용
- `timingSafeEqual` 사용 (타이밍 공격 방어)
- 페이로드: `{ transaction_id, status: 'success'|'failed', redeem_code }`
- `status === 'success'` → `inventory.status = 'minted'`, `is_minted = true`, `redeem_tx_hash` 기록
- `status === 'failed'` → `inventory.status = 'mint_failed'`, `is_minted = false` (잠금 해제, 재시도 가능)
- 단건(`redeem_code == item_uid`)과 번들(`redeem_code == SHA256 해시`) 양쪽 처리

---

## 보안 강화 (Phase 5 잔여 기술부채 해소)

### `app/api/fortem/mint/export/route.ts` ✅ (수정)
- `supabase.auth.getUser(token)` JWT 검증 추가
- 세션 유저 UID ≠ `game_user_id` 시 403 반환
- 기존 보안 (원자적 잠금, 메타데이터 화이트리스트, Sui 주소 정규식, 롤백) 유지

### `app/api/inventory/batch/route.ts` ✅ (기존 구현 유지)
- JWT 소유권 검증 이미 완료
- `item_uid` UNIQUE upsert 멱등성 보장

---

## 6슬롯 구조
```
EquipSlotId = 'Head' | 'Body' | 'Legs' | 'Shoes' | 'RightHand' | 'LeftHand'
WeaponType  = 'Sword' | 'Spear'  (Shield는 방어구 취급 — weaponType 없음)
```

## 궁극기 판정
| 장비 조합 | 궁극기 | 효과 |
|-----------|--------|------|
| RightHand: Spear (isTwoHanded) | CircleShockwave | 반경 200px 전방향 넉백, ATK×3 |
| RightHand Sword + LeftHand Sword | Whirlwind | 3초 회전 연속 타격, 틱당 ATK×0.8 |
| RightHand Sword + LeftHand Shield/없음 | MegaSwordBeam | 500px 관통 광선, ATK×4 |

## 보스 목록 (Wave 8~88)
| Wave | bossIndex | 보스 | 기믹 |
|------|-----------|------|------|
| 8  | 0 | 오크 대장 | charge |
| 16 | 1 | 독 거미 여왕 | web_slow |
| 24 | 2 | 해골 기사 | revive |
| 32 | 3 | 피의 골렘 | hp_regen |
| 40 | 4 | 그림자 암살자 | blink |
| 48 | 5 | 불꽃 술사 | fire_zone |
| 56 | 6 | 미노타우로스 | dash |
| 64 | 7 | 타락한 드래곤 | breath |
| 72 | 8 | 빙결 마법사 | frost_slow |
| 80 | 9 | 심연 악마 | summon |
| 88 | 10 | 혼돈의 화신 | multi_phase |

---

## 체크리스트 점검 결과 — 미비 3건 수정 완료

`feedbak/checklist.md` P0~P3 전체 11건 교차 검증 후 미비 3건 패치.

### Fix 1: 클라이언트 지갑 주소 Sui regex 검증 ✅
- **파일**: `app/inventory/page.tsx`
- **변경**: `walletAddress.length < 5` → `/^0x[a-fA-F0-9]{64}$/` 정규식 검증
- 서버단 regex와 동일한 수준으로 클라이언트도 강화

### Fix 2: ForTem 지갑 주소 Supabase 영속화 ✅
- **파일**: `app/inventory/page.tsx`
- **새 컬럼**: `profiles.fortem_wallet_address` (Supabase Dashboard에서 수동 추가 필요)
- **로드**: 페이지 진입 시 `profiles.fortem_wallet_address` 조회 → 자동 세팅
- **저장**: 저장 버튼 클릭 시 `profiles` upsert로 영속화
- **참고**: 로그인 방식(Google/Sui)과 무관. ForTem NFT export 목적지 주소를 별도 관리

### Fix 3: Phaser 초기화 Race Condition 방어 ✅
- **파일**: `components/game/GameCanvas.tsx`
- **변경**: `ready` state 도입 → `getSession()` + 재하이드레이션 완료 후에만 Phaser Game 생성
- userId가 null인 상태에서 LobbyScene 진입하는 문제 해결

### Supabase 수동 작업 (배포 전 필수)
- `profiles` 테이블에 `fortem_wallet_address TEXT NULL` 컬럼 추가

---

## 플레이테스트 피드백 밸런스 패치 ✅

플레이테스트 결과: 몹이 너무 느리고 적어서 박진감 없음. 보스 드롭 누락. 소각 반복 클릭 불편.

### 밸런스 상수 버프 — `game/config/constants.ts` ✅
| 상수 | Before | After | 근거 |
|------|--------|-------|------|
| `INFANTRY_SPEED` | 100 | **130** | 플레이어(220)의 59%, 확실히 쫓아오는 느낌 |
| `SPAWN_MAX_MONSTERS` | 20 | **100** | 대량 호드 가능 |

### 웨이브 스폰 대폭 증가 — `game/systems/WaveManager.ts` ✅
기본몹(Infantry) 5배, 러너 소폭 증가.

| 웨이브 | Before Infantry | After Infantry | Before Runner | After Runner |
|--------|----------------|---------------|---------------|-------------|
| Wave 1~3 | 5+w×2 (7/9/11) | **25+w×5** (30/35/40) | 1+w (2/3/4) | 유지 |
| Wave 4 Elite | 7 | **35** | 4 | **5** |
| Wave 5~7 호드 | 10+(w-5)×4 | **40+(w-5)×10** (40/50/60) | 5+(w-5)×2 | **6+(w-5)×2** (6/8/10) |
| 보스 웨이브 | 5 | **25** | 3 | **4** |

### 보스 확정 드롭 — `game/config/dropTable.ts`, `game/systems/ItemDropSystem.ts`, `game/scenes/MainScene.ts` ✅
- `rollBossDrops()`: 1~3개 아이템 확정 드롭 (확률 체크 없이 가중치 기반 선택)
- `ItemDropSystem.forceDrop(x, y, itemId)`: 확률 체크 없이 강제 드롭 메서드
- `MainScene`: `boss-died` 이벤트 수신 → `rollBossDrops()` → `forceDrop()` 호출 + cleanup 등록

### 벌크 소각 & 수량 선택 UI — `lib/store/useGameStore.ts`, `game/scenes/LobbyScene.ts` ✅
- `burnItems(uids[])`: Zustand 벌크 소각 메서드 (한번에 N개 제거 + N×10pt 부여)
- 소각 UI 분기:
  - 비장착 아이템 **1개**: 기존 즉시 소각 버튼
  - 비장착 아이템 **2개 이상**: `-`/`+` 수량 선택 → `소각 (N개, +N×10pt)` 확인 버튼 → `burnItems()` 벌크 소각

---

## Phase 5 최종 상태 — 구현 100% 완료

Phase 5에서 구현된 전체 시스템:
1. **8-Wave 챕터 루프** — 무한 챕터 순환, 웨이브별 물량/난이도 에스컬레이션
2. **11 보스 기믹** — charge, web_slow, revive, hp_regen, blink, fire_zone, dash, breath, frost_slow, summon, multi_phase
3. **6슬롯 장비 시스템** — Head/Body/Legs/Shoes/RightHand/LeftHand, 양손 무기 점유
4. **3종 궁극기** — CircleShockwave, MegaSwordBeam, Whirlwind (장비 조합 결정)
5. **아이템 드롭 & 인벤토리** — 40% 드롭, 18종 아이템, 그룹화 표시, 장착/소각/벌크소각
6. **보스 확정 드롭** — 1~3개 아이템 강제 드롭
7. **ForTem NFT 연동** — Export(민팅), Webhook 콜백, 재시도, 수량 선택 내보내기
8. **밸런스 패치** — 보병 이속 130, 최대 몬스터 100, 전 웨이브 5배 물량
9. **보안** — JWT 검증, HMAC 웹훅, Sui 주소 regex, 레이스 컨디션 방어

→ **Phase 6 진입 준비 완료**
