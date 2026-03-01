# Phase 5 레거시 데이터 마이그레이션 버그 리포트 (bug1.md)

## 보고된 증상 (Symptom)
- **로비 화면 (LobbyScene)**: 인벤토리에 있는 예전 아이템을 장착 슬롯에 올려놓으면 장착 UI에 해당 아이템의 아이콘(원 색상)이나 스탯 수치가 정상적으로 표시되지 않음.
- **인게임 화면 (MainScene)**: 로비에서 해당 아이템을 장착한 상태로 '게임 시작' 버튼을 누르면, 화면에 플레이어, 몬스터, 배경이 하나도 렌더링되지 않고 우측 상단의 미니맵(까만 상자)과 회색 배경만 출력되며 게임이 멈춤.

## 원인 분석 (Root Cause)
- **데이터 스키마 불일치 (Phase 4 vs Phase 5)**: Phase 5로 넘어오면서 인벤토리 및 장착 상태를 관리하는 `useGameStore` 내부 `OwnedItem` 객체 구조에 `def`(아이템의 상세 능력치를 담은 필수 객체)가 포함되도록 변경됨.
- **로컬 스토리지 레거시 데이터**: 유저가 이전에 Phase 4 구간에서 획득해 로컬 브라우저(`localStorage`)에 보관되어 있던 구버전 아이템 데이터들에는 이 `def` 속성이 누락(`Undefined`)되어 있음.
- **충돌 발생 지점**:
  1. `LobbyScene.ts`에서 장착된 아이템의 색상(`def.color`)이나 이름(`def.name`)을 그리려 할 때 참조 에러(`TypeError: Cannot read properties of undefined (reading 'color')`) 발생.
  2. `Player.ts` 초기화 시 6개 장착 슬롯의 스탯 합산(`def.atkBonus` 등) 로직을 처리하는 중 `def`가 없어 에러 발생. 이로 인해 `Player` 엔티티 생성이 중단되고 `MainScene` 렌더링 루프가 완전히 박살남.

## 해결 방안 / 처리 내역 (Action Taken)
이 문제는 단순한 코드 결함이 아니라, 버전 업데이트 시 발생하는 **로컬 스토리지 마이그레이션 누락** 문제입니다.
이를 강제로 해결하기 위해 `lib/store/useGameStore.ts`에 아래와 같은 복구(Migration) 패치를 적용했습니다.

1. **Zustand Store 버전 업그레이드**: `STORE_VERSION = 5` → `6`
2. **`persist` 미들웨어 마이그레이션 로직 강화**:
   버전 5 이하의 불완전한 로컬 데이터를 불러올 때, 기존 아이템 객체의 `itemId` 값을 기반으로 최신 `ITEM_DEFS[itemId]` 정보를 찾아와 **결측된 `def` 객체를 강제로 주입(Hydration)** 하도록 로직 수정.

### 마이그레이션 코드 리뷰 요청
_클로드, 이 부분 내가 Zustand persist 옵션 쪽에 아래처럼 버전을 6으로 올리고 예전 저장 데이터들을 복구해 주도록 migrate 로직을 추가해서 고쳐 놨어. 해당 로직이 우리 아키텍처에 맞게 예외 없이 잘 들어갔는지 한 번 교차 검증해 줄래?_

```typescript
// useGameStore.ts (수정된 마이그레이션 핵심 로직 요약)

const STORE_VERSION = 6; // 구버전(5 이하) 데이터에 def 객체 자동 주입 (Phase 5 호환성 패치)

...
migrate: (persisted: any, version: number) => {
    let state = persisted as any;

    if (version < 6) {
        // 인벤토리 레거시 복구
        const fixedInventory = (state.inventory || []).map((i: any) => ({
            ...i,
            def: i.def || ITEM_DEFS[i.itemId],
        })).filter((i: any) => i.def != null);

        // 장착 슬롯 레거시 복구
        const fixedEquipped: any = { ...DEFAULT_EQUIPPED };
        if (state.equipped && !Array.isArray(state.equipped)) {
            for (const key in state.equipped) {
                const item = state.equipped[key as EquipSlotId];
                if (item) {
                    const def = item.def || ITEM_DEFS[item.itemId];
                    if (def) {
                        fixedEquipped[key as EquipSlotId] = { ...item, def };
                    }
                }
            }
        }

        state = {
            ...state,
            inventory: fixedInventory,
            equipped: fixedEquipped,
            skillGauge: state.skillGauge || 0,
            _version: 6,
        };
    }
    return state as GameState;
}
```
