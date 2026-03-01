# Phase 3 — 아이템 시스템 설계서

> **상태:** 구현 완료
> **관련 Phase:** Phase 3 (드롭 + 장착 + 로비) + Phase 4 (백엔드 연결 예정)

---

## 1. 유저 플로우

```
[로비 화면] → 장비 확인/장착 → [게임 시작]
                                    ↓
                            몬스터 처치 → 40% 확률 아이템 드롭
                                    ↓
                            플레이어 접근 → 인벤토리 여유 체크
                                    ↓
                        [빈칸 있음] 획득! 팝업    [꽉 참] "인벤토리 가득!" 알림
                                    ↓
                            [게임 종료] → 로비로 복귀
                                    ↓
                        [/inventory 페이지] → 장착 / 해제 / 소각(+10pt) / NFT 내보내기
```

---

## 2. 아이템 체계

### 장착 슬롯 (2칸, 추후 4칸 확장 가능)

| 슬롯 | 타입 | 효과 |
|------|------|------|
| 무기 | weapon | ATK 보너스 |
| 방어구 | armor | HP 보너스 |

### 아이템 목록 (6종)

| ID | 이름 | 타입 | 등급 | ATK 보너스 | HP 보너스 | 드롭 가중치 |
|----|------|------|------|:---------:|:---------:|:----------:|
| sword_common | 낡은 검 | weapon | Common | +5 | 0 | 35 |
| sword_rare | 강철 검 | weapon | Rare | +10 | 0 | 12 |
| sword_epic | 영웅의 검 | weapon | Epic | +20 | 0 | 2 |
| shield_common | 나무 방패 | armor | Common | 0 | +20 | 35 |
| shield_rare | 강철 갑옷 | armor | Rare | 0 | +50 | 13 |
| shield_epic | 영웅의 갑옷 | armor | Epic | 0 | +100 | 3 |

### 등급별 드롭 확률 (몬스터 사망 시)

- 드롭 발생 확률: **40%** (60%는 아무것도 안 떨어짐)
- 드롭 발생 시 등급 확률: Common **70%**, Rare **25%**, Epic **5%**

### 인벤토리

- 보관 용량: **20칸** (장착 슬롯과 별도)
- 꽉 차면 아이템 못 주움
- 소각 시 아이템 삭제 + **10 포인트** 획득
- 포인트 사용처: 미정 (추후 슬롯 확장, 버프 구매 등)

---

## 3. 장착 효과 (밸런스 기준)

| 장비 조합 | 총 ATK | 보병 킬 | 러너 킬 | 총 HP | 러너 생존 |
|----------|:------:|:------:|:------:|:-----:|:--------:|
| 없음 | 15 | 2방 | 1방 | 100 | 6~7회 |
| Common 세트 | 20 | 2방 | 1방 | 120 | 8회 |
| Rare 세트 | 25 | 2방 | 1방 | 150 | 10회 |
| Epic 세트 | 35 | 1방 | 1방 | 200 | 13회 |

> Epic 무기(+20) 장착 시 보병(30HP)을 1방에 처치 가능 — 강력한 보상 느낌

---

## 4. 파일 구조 & 의존 관계

### 파일 목록

| 파일 | 역할 | Phase |
|------|------|:-----:|
| `game/config/items.ts` | 아이템 정의, 등급, 슬롯 타입 | 3 |
| `game/config/dropTable.ts` | 드롭 확률 테이블 + rollDrop() | 3 |
| `game/config/constants.ts` | INVENTORY_MAX_SLOTS 등 상수 | 3 |
| `game/entities/ItemDrop.ts` | 맵 위 드롭 오브젝트 (펄스 애니메이션) | 3 |
| `game/systems/ItemDropSystem.ts` | 드롭 생성 + 픽업 + 팝업 | 3 |
| `game/entities/Monster.ts` | 사망 시 'monster-died' 이벤트 emit | 2→3 |
| `game/entities/Player.ts` | 장착 보너스 ATK/HP 적용 | 2→3 |
| `game/systems/CombatSystem.ts` | bonusAtk 반영 | 2→3 |
| `game/scenes/LobbyScene.ts` | 로비 화면 (장착 슬롯 + 시작 버튼) | 3 |
| `game/scenes/MainScene.ts` | ItemDropSystem 통합 | 1→2→3 |
| `components/game/GameCanvas.tsx` | LobbyScene 씬 등록 | 1→3 |
| `lib/store/useGameStore.ts` | 인벤토리/장착/포인트/소각 상태 | 3 |
| `app/inventory/page.tsx` | 장착/해제/소각 UI + 포인트 | 3 |

### 의존 관계 다이어그램

```
items.ts (아이템 정의)
  ├── dropTable.ts ─── ItemDropSystem.ts ─── MainScene.ts
  ├── ItemDrop.ts ──── ItemDropSystem.ts
  ├── useGameStore.ts
  │     ├── Player.ts (장착 보너스)
  │     ├── LobbyScene.ts (로비 표시)
  │     ├── ItemDropSystem.ts (픽업 시 저장)
  │     └── inventory/page.tsx (UI)
  ├── LobbyScene.ts (슬롯 렌더링)
  └── inventory/page.tsx (슬롯 렌더링)

constants.ts (숫자 상수)
  └── 모든 파일에서 참조
```

---

## 5. 수정 영향도 가이드

### 아이템 추가/스탯 변경 → items.ts만 수정

`ITEM_DEFS`에 새 아이템 추가하고 `dropTable.ts`에 가중치 추가하면 끝.
나머지 코드는 데이터를 동적으로 읽으므로 수정 불필요.

```typescript
// items.ts에 추가만 하면 됨
dagger_rare: { id: 'dagger_rare', name: '독 단검', type: 'weapon', rarity: 'rare', color: 0x44ff88, atkBonus: 8, hpBonus: 0 },
```

### 드롭 확률 변경 → dropTable.ts만 수정

`DROP_CHANCE`(전체 드롭율)나 각 `weight`(가중치)만 바꾸면 됨.

### 인벤토리 용량 변경 → constants.ts만 수정

`INVENTORY_MAX_SLOTS` 값만 변경.

### 장착 슬롯 4칸 확장 → 3개 파일 수정 필요

| 수정 파일 | 변경 내용 |
|----------|----------|
| `items.ts` | `EQUIP_SLOTS` 배열에 2칸 추가 |
| `useGameStore.ts` | `equipped` 타입에 새 슬롯 키 추가 |
| `LobbyScene.ts` | 슬롯 렌더링 위치 조정 (자동으로 늘어나긴 하지만 레이아웃 확인) |
| `inventory/page.tsx` | 자동으로 늘어남 (EQUIP_SLOTS를 루프 돌므로) |

### 새로운 아이템 타입 추가 (예: 장신구) → 2개 파일 수정

| 수정 파일 | 변경 내용 |
|----------|----------|
| `items.ts` | `ItemType`에 `'accessory'` 추가 + EQUIP_SLOTS에 슬롯 추가 + ITEM_DEFS에 아이템 추가 |
| `useGameStore.ts` | `equipped`에 새 슬롯 키 추가 |

---

## 6. 미구현 (추후 Phase에서)

- [ ] 초기 장비 지급 (sword_common + shield_common 자동 지급)
- [ ] Phase 4: 아이템 획득 시 `POST /api/inventory` DB 저장
- [ ] Phase 4: 인벤토리 페이지에서 NFT 내보내기 연결
- [ ] 포인트 사용처 결정 (슬롯 확장? 버프?)
- [ ] 장착 슬롯 4칸 확장
- [ ] 모바일: 로비 화면 터치 UI 최적화
