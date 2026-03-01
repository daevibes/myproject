# Phase 4 코드 리뷰 피드백

## 🔴 즉시 수정 (버그)

### 1. GameCanvas.tsx — config 중복 선언 버그
- **위치**: `components/game/GameCanvas.tsx:28-43`
- **문제**: Phaser config 객체에 `scale`, `backgroundColor`, `scene` 키가 두 번씩 선언됨.
  JS는 마지막 값만 유효하므로 현재는 동일 값이라 우연히 동작하지만, 향후 수정 시 버그 원인이 됨.
- **수정**: 중복 키 제거, config 객체 1회만 선언.

### 2. export/route.ts — 민팅 성공 후 DB status 미업데이트
- **위치**: `app/api/fortem/mint/export/route.ts:59`
- **문제**: 민팅 성공 응답을 반환하지만, DB의 `status`가 `'minting_in_progress'`에 그대로 머뭄.
  → 웹훅 없이는 `status: 'minted'`로 절대 갱신되지 않음.
- **수정**: 성공 반환 직전에 DB 업데이트 쿼리 추가.
  ```ts
  await supabase.from('inventory')
      .update({ status: 'minted', is_minted: true, redeem_tx_hash: mintResponse.data?.objectId })
      .eq('id', lockedItemId);
  ```

---

## 🟡 Phase 5 전 보완 권장

### 3. GameCanvas.tsx — Race Condition (userId 세팅 전 픽업 가능)
- **위치**: `components/game/GameCanvas.tsx:14-21`
- **문제**: `getUser()`가 비동기라 Phaser 초기화보다 늦게 완료될 수 있음.
  게임 시작 직후 픽업한 아이템은 `userId=null` → API 호출 스킵 → DB에 미저장.
- **현재 방어**: `ItemDropSystem.ts:64` `if (userId)` 체크로 스킵만 함 (silent miss).
- **수정 방향**: MVP 허용 범위이나 에러 로그라도 남기는 것 권장.
  ```ts
  if (userId) {
      fetch(...).catch(e => console.error('[Phase4 Sync Failed]', { userId, uid: drop.uid, error: e.message }));
  } else {
      console.warn('[Phase4] userId 없음 — DB 저장 스킵:', drop.uid);
  }
  ```

### 4. export/route.ts — redeemCode 멱등성 문제
- **위치**: `app/api/fortem/mint/export/route.ts:50`
- **문제**: `redeemCode: in_game_item_id + "_" + Date.now()` → 재시도 시 매번 다른 코드 생성.
  ForTem 측에서 중복 민팅 방어 시 동일 코드로 요청해야 멱등성 보장됨.
- **수정**: `item_uid`를 redeemCode로 사용.
  ```ts
  redeemCode: body의 item_uid 또는 lockedItemId,
  ```

### 5. /inventory/page.tsx — mint_failed 재시도 CTA 없음
- **위치**: `app/inventory/page.tsx`
- **문제**: DB에 `mint_failed` 상태가 기록되어도 유저에게 재시도 버튼이 없음.
  export route 백엔드는 이미 `.in('status', ['available', 'mint_failed'])`로 재시도 허용 중.
  → 프런트만 추가하면 됨.
- **수정 방향**:
  - `mint_failed` 카드에 빨간 뱃지 "⚠️ 민팅 실패" 표시
  - 해당 카드 선택 시 하단 CTA "재시도 (Retry Export)" 활성화
  - 기존 export API 그대로 재호출

### 6. GameCanvas.tsx — 재하이드레이션 로직 미구현
- **위치**: `components/game/GameCanvas.tsx:14-21`
- **문제**: 다른 기기 접속 또는 localStorage 초기화 시 인벤토리 소실.
  `GET /api/inventory` 엔드포인트는 이미 존재하지만 호출하지 않음.
- **수정 방향**: userId 세팅 직후 DB 조회 → 로컬에 없는 아이템만 Zustand에 병합.
  ```ts
  // userId 세팅 후 바로
  const res = await fetch(`/api/inventory?game_user_id=${data.user.id}`);
  const { items } = await res.json();
  const localUids = new Set(store.inventory.map(i => i.uid));
  const newItems = items
      .filter(dbItem => !localUids.has(dbItem.item_uid))
      .map(dbItem => ({
          uid: dbItem.item_uid,
          itemId: dbItem.in_game_item_id,
          def: ITEM_DEFS[dbItem.in_game_item_id],
      }))
      .filter(item => item.def != null);
  if (newItems.length > 0) {
      useGameStore.setState(s => ({
          inventory: [...s.inventory, ...newItems].slice(0, INVENTORY_MAX_SLOTS)
      }));
  }
  ```

---

## 🟠 보안 (Phase 5 전 권장)

### 7. inventory/route.ts — game_user_id 소유권 검증 없음
- **위치**: `app/api/inventory/route.ts:29`
- **문제**: 클라이언트가 임의의 `game_user_id`를 body에 담아 보내면 다른 사람의 인벤토리에 아이템을 추가할 수 있음.
- **수정 방향**: Supabase JWT로 실제 로그인한 유저 ID와 비교 검증.

### 11. 게임 강제 종료 어뷰징 방지 (인벤토리 지연 일괄 저장) [Phase 5 도입 권장]
- **위치**: `game/systems/ItemDropSystem.ts`, `game/scenes/MainScene.ts`, `lib/store/useGameStore.ts` 등
- **문제**: 현재 아이템을 획득(Pickup)하는 즉시 DB와 Zustand 인벤토리에 실시간 영구 저장됨. 이로 인해 유저가 게임 중 희귀 아이템만 먹고 고의로 게임을 끄거나 새로고침해도 아이템이 보존되어 게임의 긴장감과 재미가 크게 훼손됨 (어뷰징).
- **요구사항**: 
  1. **[임시 인벤토리]** 인게임 중 먹은 아이템은 `pendingInventory`(임시 스토어 상태 등 별도 공간)에만 보관하고, 즉시 DB API(`POST /api/inventory`)를 호출하지 않음.
  2. **[게임 오버 판정]** 플레이어가 죽거나(`Game Over`), 스테이지를 완수하여 게임이 정상적으로 종료되었을 때만 결과창(Result 씬)에서 획득한 아이템 목록 전체를 DB에 일괄 저장(Batch Insert) 처리. 
  3. 성공적으로 DB 응답을 받으면 그때 진짜 `inventory`로 합치고, 게임 진행 중 브라우저를 강제 이탈하면 그 판에서 먹은 것들은 모두 자동 소멸됨.
  ```ts
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user || user.id !== game_user_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  ```

---

## 🔵 ForTem 스펙 확정 후 구현

### 8. 웹훅 엔드포인트 신규 구현
- **생성할 파일**: `app/api/webhook/fortem/route.ts`
- **역할**: ForTem이 민팅 완료/실패 시 호출하는 Callback 수신
- **핵심 구현 사항**:
  1. ForTem 서명(Signature) 검증 — HMAC-SHA256
  2. 이벤트 파싱 (`item.minted` / `item.mint_failed`)
  3. `redeemCode`(= item_uid)로 DB 레코드 조회 후 status 업데이트
  4. 멱등성 처리 — 이미 `minted`면 200 반환 후 스킵

## 🔵 Phase 5 전 필수 신규 기획 (기능 확장 및 핫픽스)

### 9. export/route.ts — PGRST116 (Multiple Rows) 치명적 버그 방지 (핫픽스)
- **위치**: `app/api/fortem/mint/export/route.ts` & `app/inventory/page.tsx`
- **문제**: 유저가 이름이 같은 아이템(예: `sword_lv50`)을 여러 개 보유하고 있을 때, 클라이언트가 `in_game_item_id`만 보내면 DB에서 `.single()` 호출 시 매칭되는 로우가 여러 개라 크래시(PGRST116) 발생.
- **수정 방향**: 프론트엔드가 내보낼 정확한 `item_uid`를 payload에 포함하여 보내고, 백엔드 쿼리는 반드시 `eq('item_uid', item_uid)` 로 잠금(Lock)을 걸어 단일 객체 조작을 보장할 것.

### 10. 아이템 수량 표시 및 다중 민팅(Multi-Minting) 지원 (Option A)
- **위치**: `app/inventory/page.tsx`, `app/api/fortem/mint/export/route.ts`
- **문제**: 동일 아이템을 여러 개 획득하면 UI에 중복된 카드가 도배되고, 민팅 시 1개씩만 가능하여 UX가 불편함.
- **요구사항 (Option A: 단일 통합 NFT + 수량 메타데이터 표시)**:
  1. **[인벤토리 병합 UI (로비 & NFT 상점 공통)]** 로직상 아이템을 획득할 때는 각각 인벤토리 칸을 차지하든, 아니면 동일 아이템 획득 시 기존 슬롯의 수량만 증가시키든 상관없이 **최종 화면에 보여줄 때는** 동일한 `in_game_item_id`는 무조건 딱 1칸의 UI 슬롯(카드)만 차지하도록 렌더링하고 우측 하단이나 상단에 총 보유 수량(`x3`, `x10` 등) 뱃지를 표시. (이는 게임 내 로비 인벤토리 화면과 `/inventory` 웹페이지 양쪽 모두에 적용되어야 함)
  2. **[수량 입력 폼]** 보유 수량이 1개를 초과하는 아이템 카드를 선택하면, 몇 개를 내보낼 것인지 수량을 입력받는 UI를 노출. (유저가 보유한 최대 수량 범위를 절대 초과해서 입력할 수 없도록 강제 방어 처리 필수).
  3. **[API 요청]** `/api/fortem/mint/export` 호출 시 `quantity: N` 파라미터 추가 전송.
  4. **[DB N개 락(Lock)]** 백엔드는 해당 `in_game_item_id` 중 `status: 'available'`인 로우를 정확히 N개 찾아내어(`limit(N)`) 배열 형태로 락(Lock)을 걸고 진행.
  5. **[패키지 민팅]** ForTem `items.create` 호출 시 **1개의 묶음 NFT**만 발행함. 즉, 유저가 10개를 묶어서 민팅했다면 10개짜리 수량 메타데이터를 포함한 **단 1개의 통짜(Indivisible) NFT**가 발급됨. (향후 ForTem이나 마켓에서 1개씩 낱개로 쪼개서 분할 판매하는 것은 불가능하다는 정책). 성공 시 N개의 DB 로우를 모두 `minted` 처리.

---
### 11. 
1. [인게임 임시 저장]: 게임 중 획득(Pickup)한 아이템은 pendingInventory 같은 인게임 전용 임시 공간에 보관하고, 즉각적인 DB 저장은 스킵.
2. [게임 종료 시 일괄 저장]: 유저가 몬스터에게 죽어서 Game Over 창이 뜨거나, 스테이지 클리어로 Result 화면이 떴을 때, 임시 보관 중이던 획득 아이템 목록을 모아서 DB로 일괄 저장(Batch Insert) API 호출.
3. [먹튀 방지(일부 허용)]: 원칙상 강제 이탈 시 아이템 소멸이 맞으나, **현재는 ESC 메뉴에서 '종료하기'를 눌러 로비로 나가는 정상 중도 포기 케이스에서는 획득한 아이템 저장을 허용함.** (즉, 현재 클로드가 구현한 `MainScene.ts`의 `flushAndSave()` 흐름 유지)

## 실행 우선순위 요약

| 순위 | 파일 | 작업 | 난이도 |
|---|---|---|---|
| 0 | `export/route.ts` | **(핫픽스)** PGRST116 에러 방지를 위한 `item_uid` 잠금 | 중요 |
| 1 | `GameCanvas.tsx` | config 중복 제거 | 쉬움 |
| 2 | `export/route.ts` | 민팅 성공 후 DB 업데이트 추가 | 쉬움 |
| 3 | `export/route.ts` | redeemCode → item_uid 교체 | 쉬움 |
| 4 | `ItemDropSystem.ts` | 에러 로그 상세화 | 쉬움 |
| 5 | `GameCanvas.tsx` | 재하이드레이션 로직 추가 | 보통 |
| 6 | `/inventory/page.tsx` | mint_failed CTA 추가 | 보통 |
| 7 | `inventory/route.ts` | 소유권 검증 추가 | 보통 |
| 11 | `ItemDropSystem.ts` 외 | **(Phase 5 권장)** 게임 종료 시점 획득 아이템 일괄 DB 저장 | 보통 |
| 8 | 신규 파일 | 웹훅 엔드포인트 구현 | 복잡 |
| 9 | `page.tsx` 외 | 옵션 A: 다중 수량 선택 UI 및 메타데이터 통합 민팅 기획 추가 | 복잡 |
