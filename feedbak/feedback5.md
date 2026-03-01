# Phase 5 피드백 (검토 결과)

전체적으로 기획된 기능들(8-Wave 루프, 11보스 기믹, 6슬롯 UI, NFT 내보내기 묶음 처리 등)은 빠짐없이 구현되어 있으나, 동작과 논리에 큰 문제가 발생할 수 있는 3가지 치명적 버그 및 기술 부채를 발견했습니다. 다음 단계로 넘어가기 전에 반드시 수정해야 합니다.

## 1. [스탯 연산 버그] 양손 무기 장착 시 스탯 2배 뻥튀기
**발견 파일**: `game/entities/Player.ts`, `game/scenes/LobbyScene.ts`
- **원인**: `useGameStore.ts`의 `equip()` 로직에서 양손 무기(Spear) 하나를 장착할 때 `RightHand`와 `LeftHand` 슬롯에 동일한 아이템 객체를 할당합니다. 그런데 스탯을 계산하는 로직에서 단순히 `Object.values(equipped)` 리스트를 순회하며 모든 슬롯의 스탯을 합산하기 때문에, **1개의 양손 무기 스탯이 2번 중복 합산**됩니다. (예: 나무 창 1개 장착 시 ATK+8이 ATK+16으로 적용됨)
- **참고 사항 (쌍검과의 차이)**: 우측 슬롯에 '검', 좌측 슬롯에 '단검' 등 **고유한 아이템 2개를 각각 장착한 쌍검 상태**일 때는 각각의 공격력이 모두 더해지는 것이 **정상적인 기획 의도**입니다. 여기서 지적하는 버그는 오직 **'isTwoHanded: true' 속성을 가진 1개의 무기**를 꼈을 때만 발생하는 스탯 뻥튀기 현상입니다.
- **해결 방안**: `Object.values(equipped)` 순회 시 중복된 아이템(`uid` 기준)을 Set 등을 사용해 한 번만 합산하도록 필터링하거나, 양손 무기의 보조 슬롯 위치에서는 스탯 합산을 스킵하는 예외 처리가 필요합니다.

## 2. [기믹 누락 버그] FireZone (화염장판)의 틱 타이머 무시
**발견 파일**: `game/entities/FireZone.ts`
- **원인**: `FireZone` 설정에 700ms 간격(`FIRE_ZONE_TICK`)으로 데미지를 주기 위해 `tickTimer`를 등록했지만, 정작 매 프레임 실행되는 `update()` 메서드에서는 이 타이머를 확인하지 않습니다. 대신 `if (inZone && !player.isInvincible)` 조건만으로 `takeDamage`를 즉시 호출합니다.
- **결과**: `FIRE_ZONE_TICK`(700ms)이 완전히 무시되고, 플레이어의 피격 무적 시간(`PLAYER_IFRAME`, 500ms)이 끝나는 즉시 데미지가 들어와 사실상 **500ms 간격으로 데미지**가 들어가게 됩니다.
- **해결 방안**: `update()` 안에서 `isInvincible`만을 체킹하는 대신, `tickTimer`의 콜백 안에서 플레이어가 영역 내에 있는지 확인하고 데미지를 주는 방식이나 도트 뎀 버프를 걸어주는 방식으로 수정이 필요합니다.

## 3. [비동기 처리/논리 버그] ForTem Webhook의 상태 업데이트 오류
**발견 파일**: `app/api/fortem/mint/export/route.ts`, `app/api/webhook/fortem/route.ts`
- **원인 1 (상태 업데이트 동기화 문제)**: `export/route.ts` 에서 민팅 API 호출 성공 직후 DB를 조작할 때, 상태를 바로 `status: 'minted'`로 확정 지어버립니다. 
  - 정작 나중에 결과를 받는 웹훅에서는 `.eq('status', 'minting_in_progress')`인 항목만 업데이트하도록 작성되어 있어, 만약 비동기 민팅이 실패했을 때 `mint_failed`로 롤백하지 못합니다. (조건에 걸리는 로우가 0건이기 때문)
- **원인 2 (번들 폴백 비교키 불일치)**: 번들 민팅 시 DB에는 `redeemCode`(SHA256 해시)를 전혀 저장하지 않고, `redeem_tx_hash` 항목에 `transaction_id`를 기록합니다. 
  - 그런데 웹훅에서 번들 처리를 하는 Fallback 로직이 `eq('redeem_tx_hash', redeem_code)` 로 되어있어, `transaction_id` 필드 값과 웹훅 페이로드의 `redeem_code`를 비교하고 있습니다. 두 값은 애초에 다른 값이기 때문에 폴백 매칭이 절대 이뤄질 수 없습니다.
- **해결 방안**: 
  1. `export/route.ts`에서 상태를 `minted`가 아닌 `minting_in_progress`로만 저장하여, 웹훅이 최종 결과를 기록(`minted` or `mint_failed`)할 수 있도록 넘겨줘야 합니다.
  2. 웹훅 번들 폴백 조건을 `.eq('redeem_tx_hash', transaction_id)` 로 비교해야 정상 동작합니다.

## 4. [기술 부채/기능 누락] 인게임 인벤토리 DB ↔ Zustand 동기화 (Redeem 반영 불가)
**연관 기획**: Phase 4의 ForTem NFT 리딤(Redeem) 연동 및 인게임 임포트
- **배경 컨텍스트 (클로드코드 참고용)**: 
  현재 우리 게임은 몬스터 사냥 시 획득한 아이템을 클라이언트의 `localStorage`(Zustand의 `persist` 미들웨어)에 우선 임시 저장하고, 게임 오버/종료 시에만 한꺼번에 서버 DB(`POST /api/inventory/batch`)로 동기화하는 구조를 가집니다.
  반면, 외부 ForTem 플랫폼에서 유저가 NFT를 소각하고 다시 인게임으로 되돌리는 "리딤(Redeem)"을 수행하면, `app/api/webhooks/fortem/redeem/route.ts` 웹훅이 실행되어 로컬 스토리지와 무관하게 즉시 DB의 `inventory` 테이블에 새 아이템 데이터(`status: 'available'`)를 INSERT 해버립니다.
- **현재 발생하는 문제**: 
  클라이언트 코드는 서버 DB의 데이터를 가져오는 기능 없이, 오로지 자신의 `localStorage` 상태만 읽어서 인벤토리 UI(`LobbyScene`)를 렌더링하고 있습니다. 따라서 외부에서 리딤되어 DB에 새로운 아이템이 들어왔음에도 불구하고, 유저가 게임에 접속하면 클라이언트 화면에는 추가된 아이템이 전혀 보이지 않는 동기화 단절 현상이 발생합니다. 
- **해결 및 구현 방향 (Action Item)**:
  `LobbyScene`(로비 화면) 진입 시점 혹은 앱 최상단 진입 시점에서 **DB의 최신 인벤토리 상태를 가져와 Zustand Store 상태에 덮어쓰거나 병합(Hydration)해 주는 로직**을 추가해야 합니다.
  1. 기존에 만들어진 `GET /api/inventory` (또는 유저 ID를 활용한 유사 엔드포인트)를 호출하여 서버 DB의 최신 아이템 배열을 가져옵니다.
  2. 가져온 데이터를 Zustand 스토어(`useGameStore`)에 주입할 수 있도록 `hydrateInventory(items)` 같은 Action 메서드를 스토어에 추가합니다.
  3. 로비 화면 렌더링 시 React `useEffect` 등을 활용해 위 동기화 로직을 한 번 실행시켜, 리딤된 아이템이 클라이언트 화면에도 정상적으로 등장하게 만듭니다.

위의 네 가지 주요 이슈와 기술 부채가 해결되면 다음 단계로 넘어가도 좋습니다!
