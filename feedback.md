# Code Review 최종 피드백 — ForTem Web3 게임 인프라

> **점검일:** 2026-02-26
> **점검 대상:**
> - `app/api/fortem/mint/export/route.ts` (민팅 & 롤백)
> - `app/api/webhooks/fortem/redeem/route.ts` (웹훅 서명 검증 & 멱등성)
> - `app/inventory/page.tsx` (지갑 입력 & 민팅 UI)
> - `app/api/inventory/route.ts` (인벤토리 조회/생성 API)
>
> **분류 기준:** P0(배포 차단) / P1(배포 전 필수) / P2(배포 후 빠른 개선) / P3(품질 향상)

---

## P0 — 배포 차단급 (이것 안 고치면 자산 사고)

### #01. 이중 민팅 레이스 컨디션

- **파일:** `mint/export/route.ts` 22~39행
- **현상:** SELECT(확인)와 UPDATE(잠금)가 별도 쿼리. 동시 요청 시 둘 다 통과하여 같은 아이템 NFT 2개 발행
- **수정:** 단일 UPDATE 쿼리로 합침 (`UPDATE ... WHERE is_minted = false` → 0행이면 이미 처리됨)

```typescript
const { data: locked, error: lockError } = await supabase
    .from('inventory')
    .update({ is_minted: true, status: 'minting_in_progress' })
    .eq('game_user_id', game_user_id)
    .eq('in_game_item_id', in_game_item_id)
    .eq('is_minted', false)
    .eq('status', 'available')
    .select('id')
    .single();

if (lockError || !locked) {
    return NextResponse.json({ error: 'Item unavailable' }, { status: 409 });
}
```

---

### #02. 웹훅 멱등성 실패 — 아이템 중복 지급

- **파일:** `webhooks/fortem/redeem/route.ts` 48~71행
- **현상:** SELECT → INSERT 패턴. 동시 웹훅 시 둘 다 "없음" 확인 후 둘 다 INSERT 성공
- **수정 2단계:**
  - **(DB)** `ALTER TABLE inventory ADD CONSTRAINT unique_redeem_tx_hash UNIQUE (redeem_tx_hash);`
  - **(코드)** SELECT 제거, INSERT 후 에러코드 `23505`(unique violation)이면 `already_processed` 반환

```typescript
const { error: insertError } = await supabase.from('inventory').insert({ ... });
if (insertError) {
    if (insertError.code === '23505') {
        return NextResponse.json({ status: 'already_processed' }, { status: 200 });
    }
    throw new Error(`DB Insert Failed: ${insertError.message}`);
}
```

---

### #03. API 인증 완전 부재 — 타인 아이템 탈취 가능

- **파일:** `mint/export/route.ts` 15~16행, `api/inventory/route.ts` 8~10행
- **현상:** `game_user_id`를 클라이언트가 body/query로 직접 전달. 서버가 "이 요청자가 이 유저 본인인지" 전혀 확인 안 함. 아무나 다른 유저의 아이템 조회/민팅 가능
- **수정:** Supabase Auth (또는 세션 토큰)로 서버에서 인증된 `user.id`를 꺼내 대조. 최소한 middleware 레벨에서 토큰 검증 필수

---

## P1 — 배포 전 필수 수정

### #04. 서명 비교 타이밍 공격 취약

- **파일:** `webhooks/fortem/redeem/route.ts` 31행
- **현상:** `===` 비교는 첫 불일치 바이트에서 즉시 반환. 응답 시간 분석으로 서명 역산 가능
- **수정:** `crypto.timingSafeEqual(Buffer, Buffer)` 사용

```typescript
const expectedBuf = Buffer.from(expectedSignature, 'hex');
const signatureBuf = Buffer.from(signature, 'hex');
if (expectedBuf.length !== signatureBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
}
```

---

### #05. 타임아웃 시 잘못된 즉시 롤백 — 자산 복제 위험

- **파일:** `mint/export/route.ts` 70~76행
- **현상:** ForTem API가 타임아웃이면 catch에서 `status: 'available'`로 즉시 복구. 하지만 블록체인에선 민팅 진행 중일 수 있음 → 같은 아이템 재민팅 가능
- **수정:** `available`이 아닌 `mint_failed`로 전환. 별도 배치 잡(cron)으로 ForTem 트랜잭션 상태 조회 후 진짜 실패한 것만 복구

---

### #06. 롤백 실패 시 아이템 영구 잠김

- **파일:** `mint/export/route.ts` 72~75행
- **현상:** 롤백 UPDATE의 에러를 확인하지 않음. 네트워크 장애로 롤백도 실패하면 아이템이 `minting_in_progress`에서 영원히 해제 안 됨
- **수정:** 롤백 결과 확인 + 실패 시 운영 알림(Slack/Sentry) 발송. 장기 잠김 아이템 탐지 배치잡 추가

```typescript
if (lockedItemId) {
    const { error: rollbackError } = await supabase
        .from('inventory')
        .update({ is_minted: false, status: 'mint_failed' })
        .eq('id', lockedItemId);

    if (rollbackError) {
        console.error(`[CRITICAL] Rollback FAILED for item ${lockedItemId}`);
        // TODO: Slack/Discord 웹훅으로 운영팀 즉시 알림
    }
}
```

---

### #07. `network` 값 클라이언트 조작 가능

- **파일:** `mint/export/route.ts` 45행, `inventory/page.tsx` 7행
- **현상:** 클라이언트가 body에 `network: "sui-mainnet"` 보내면 메인넷 민팅 실행됨
- **수정:** 서버 환경변수(`process.env.FORTEM_NETWORK`)로 고정. body의 network 무시

---

### #08. `studio_id`도 클라이언트 조작 가능

- **파일:** `mint/export/route.ts` 49행, `inventory/page.tsx` 6행
- **현상:** `studioId`가 클라이언트 body에서 옴. 다른 스튜디오 ID를 넣으면 의도치 않은 동작 가능
- **수정:** `process.env.FORTEM_STUDIO_ID`로 서버에서 고정

---

### #09. 에러 메시지 내부 정보 노출

- **파일:** `mint/export/route.ts` 78행
- **현상:** `error.message`가 그대로 클라이언트에 반환. Supabase 테이블명, ForTem SDK 내부 에러 등 노출 가능
- **수정:** 클라이언트에는 일반 메시지만 반환, 상세 에러는 서버 로그에만

```typescript
return NextResponse.json(
    { error: 'Minting failed. Please try again.' },
    { status: 500 }
);
```

---

### #10. 지갑 주소 형식 검증 없음 (클라이언트 + 서버 모두)

- **파일:** `inventory/page.tsx` 35~38행, `mint/export/route.ts` 18행
- **현상:** 아무 문자열이든 지갑 주소로 통과. 잘못된 주소로 NFT 전송 시 자산 영구 소실
- **수정:** Sui 주소 정규식 `/^0x[a-fA-F0-9]{64}$/` 검증을 클라이언트와 서버 양쪽에 추가

```typescript
// 클라이언트 (inventory/page.tsx)
const SUI_ADDRESS_REGEX = /^0x[a-fA-F0-9]{64}$/;
if (!SUI_ADDRESS_REGEX.test(trimmed)) {
    alert("유효한 Sui 지갑 주소를 입력해주세요 (0x + 64자리 hex)");
    return;
}

// 서버 (mint/export/route.ts)
if (!SUI_ADDRESS_REGEX.test(wallet_address)) {
    return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
}
```

---

### #11. 인벤토리 조회 API도 인증 없음

- **파일:** `api/inventory/route.ts` 8~11행
- **현상:** GET `/api/inventory?game_user_id=아무거나`로 다른 유저 인벤토리 전체 열람 가능
- **수정:** #03과 동일하게 인증 적용

---

## P2 — 배포 후 빠른 개선

### #12. 웹훅 Replay 공격 미방어

- **파일:** `webhooks/fortem/redeem/route.ts` 전체
- **현상:** 서명은 검증하나 타임스탬프 검증이 없음. 과거 유효했던 웹훅 payload+signature를 재전송하면 통과
- **수정:** ForTem이 타임스탬프 헤더를 제공한다면, 현재 시간과 비교하여 예: 5분 이상 된 요청 거부

---

### #13. 지갑 주소 localStorage만 사용 — 서버 저장 필요

- **파일:** `inventory/page.tsx` 18~19행, 40행
- **현상:** 지갑 주소가 브라우저에만 저장. 브라우저/기기 변경 시 유실. XSS 취약점과 결합 시 탈취 가능
- **수정:** Supabase `profiles` 테이블에 서버사이드 저장. `localStorage`는 캐시 용도로만

---

### #14. `metadata` 검증 없이 ForTem에 전달

- **파일:** `mint/export/route.ts` 53행, `inventory/page.tsx` 64행
- **현상:** 클라이언트가 보낸 metadata 객체를 그대로 ForTem API에 전달. 악의적 데이터 주입 가능
- **수정:** 서버에서 허용된 필드만 화이트리스트로 추출하여 전달

---

### #15. "DB 롤백 완료됨" 거짓 UX 메시지

- **파일:** `inventory/page.tsx` 79행
- **현상:** 클라이언트는 서버 롤백 성공 여부를 모르는데 항상 "롤백 완료"라고 표시
- **수정:** `"문제가 발생했습니다. 잠시 후 다시 시도해주세요."` 등 안전한 문구로 변경

---

### #16. 웹훅 `.single()` 에러 무시

- **파일:** `webhooks/fortem/redeem/route.ts` 48~52행
- **현상:** `.single()`은 0행이면 에러를 반환. `checkError`를 검사하지 않아 실제 DB 장애와 "행 없음"을 구분 못함
- **수정:** #02 수정(UNIQUE 제약 방식)을 적용하면 이 SELECT 자체가 제거되어 해결됨. 만약 유지한다면 `.maybeSingle()`로 교체

---

## P3 — 품질/성능 향상

### #17. 하드코딩 테스트 상수 제거

- **파일:** `inventory/page.tsx` 5~7행
- **현상:** `TEST_USER_ID`, `TEST_STUDIO_ID`, `NETWORK`가 코드에 직접 작성. 프로덕션 시 반드시 인증 기반으로 교체 필요
- **수정:** 인증 시스템(#03) 구현 후 세션에서 `userId` 획득. `studioId`, `network`는 서버 환경변수

---

### #18. Next.js Server/Client 컴포넌트 분리

- **파일:** `inventory/page.tsx` 전체
- **현상:** 전체가 `"use client"`. 초기 데이터를 useEffect로 가져와서 빈 화면 → 로딩 → 표시 순서로 깜빡임 발생
- **수정:** Server Component에서 초기 데이터를 fetch하고 Client Component에 `initialItems` props로 전달

```
app/inventory/
├── page.tsx              ← Server Component (데이터 초기 fetch)
└── InventoryClient.tsx   ← Client Component (상호작용 UI)
```

---

### #19. TypeScript `any[]` 타입 제거

- **파일:** `inventory/page.tsx` 10행
- **현상:** `useState<any[]>` 사용. 타입 안전성 없음
- **수정:** `InventoryItem` 인터페이스 정의

```typescript
interface InventoryItem {
    id: string;
    game_user_id: string;
    in_game_item_id: string;
    is_minted: boolean;
    status: 'available' | 'minting_in_progress' | 'minted' | 'mint_failed';
    redeem_tx_hash?: string;
    created_at: string;
    updated_at: string;
}
```

---

### #20. 샘플 아이템 생성 API 프로덕션 제거/보호

- **파일:** `api/inventory/route.ts` 24~38행
- **현상:** POST로 아무나 아이템 생성 가능. 테스트용이라도 프로덕션에 노출되면 무한 아이템 생성
- **수정:** 프로덕션 빌드에서 제거하거나 관리자 전용 인증 적용

---

## 요약

| 등급 | 건수 | 핵심 키워드 |
|:----:|:----:|------------|
| **P0 배포 차단** | 3건 | 이중 민팅, 중복 지급, 인증 부재 |
| **P1 배포 전 필수** | 8건 | 타이밍 공격, 롤백 설계, 입력 검증, 정보 노출 |
| **P2 배포 후 개선** | 5건 | Replay 방어, 서버 저장, metadata 검증 |
| **P3 품질 향상** | 4건 | 테스트 코드 정리, 타입, 컴포넌트 분리 |
| **합계** | **20건** | |

---

## 수정 항목 간 의존성 분석

> 아래 의존 관계를 무시하고 항목을 임의 순서로 수정하면 코드가 꼬입니다.
> 반드시 의존 체인을 확인한 뒤 작업 순서를 정해 주세요.

### 충돌 1. 인증(#03)이 안 끝나면 4개 항목을 건드릴 수 없다

```
#03 인증 시스템 ─┬──→ #11 인벤토리 API 인증 (같은 auth 시스템 공유)
                 ├──→ #17 TEST_USER_ID 제거 (인증 없으면 유저 ID를 가져올 곳이 없음)
                 ├──→ #13 지갑 서버 저장 (누구의 지갑인지 식별하려면 인증 필요)
                 └──→ #18 Server/Client 분리 (Server Component에서 인증 세션 접근 필요)
```

- **위험:** #03 없이 #17을 먼저 하면 (`TEST_USER_ID` 제거) → 유저를 식별할 수단이 사라져서 앱 전체 작동 불능
- **위험:** #03 없이 #13을 먼저 하면 (지갑 서버 저장) → "누구의 지갑?"을 알 수 없어서 저장 자체가 무의미

### 충돌 2. `mint_failed` 상태 도입(#05)은 3곳을 동시에 바꿔야 한다

```
#05 롤백 상태 변경 ─┬──→ #06 롤백 에러 처리 (같은 catch 블록 — 반드시 함께 수정)
(available → mint_failed) │
                          ├──→ #19 TypeScript 타입 ('mint_failed'를 status union에 추가)
                          │
                          └──→ inventory/page.tsx UI
                               (버튼 텍스트에 mint_failed 상태 분기 추가 필요)
```

- **위험:** 서버에서 `mint_failed` 상태를 저장하는데 UI에서 이 상태를 처리 안 하면 → 유저에게 아이템이 보이지만 버튼이 "처리 중..."으로 영원히 남아 CS 폭주

### 충돌 3. 서버 고정값(#07, #08) 변경 시 클라이언트-서버 동기화

```
#07 network 서버 고정 ──┐
                        ├──→ mint/export/route.ts의 필수값 검증(18행)도 함께 수정 필요
#08 studio_id 서버 고정 ┘    (validation에서 해당 필드 제거 안 하면 모든 요청 400 에러)
```

- **안전한 순서:** 서버를 먼저 수정(환경변수 사용 + validation에서 해당 필드 제거) → 이후 클라이언트에서 해당 필드 전송 제거. 역순이면 깨짐

### 충돌 4. DB 스키마 변경(#02) 전 기존 데이터 확인 필요

```
#02 UNIQUE 제약 추가 ──→ 기존 테이블에 동일 redeem_tx_hash 중복 행이 있으면 ALTER TABLE 실패
```

- **안전책:** UNIQUE 제약 추가 전에 아래 쿼리로 중복 데이터 확인 먼저 실행:

```sql
SELECT redeem_tx_hash, COUNT(*)
FROM inventory
WHERE redeem_tx_hash IS NOT NULL
GROUP BY redeem_tx_hash
HAVING COUNT(*) > 1;
```

### 독립 수정 가능 항목 (순서 무관, 병렬 작업 OK)

| 항목 | 수정 범위 | 다른 항목과 안 겹치는 이유 |
|------|----------|--------------------------|
| #01 원자적 UPDATE | `mint/export/route.ts`만 | 쿼리 패턴 변경, 다른 파일 무관 |
| #04 timingSafeEqual | `webhooks/redeem/route.ts`만 | 비교 함수 1줄 교체 |
| #09 에러 메시지 마스킹 | `mint/export/route.ts`만 | return 문자열 변경 |
| #10 지갑 주소 검증 | 클라이언트 + 서버 각각 | 검증 로직 추가만, 기존 흐름 불변 |
| #12 Replay 방어 | `webhooks/redeem/route.ts`만 | 타임스탬프 체크 추가 |
| #14 metadata 검증 | `mint/export/route.ts`만 | 화이트리스트 필터 추가 |
| #15 UX 메시지 수정 | `inventory/page.tsx`만 | 문자열 변경 |
| #20 샘플 API 보호 | `api/inventory/route.ts`만 | 조건 분기 추가 |

---

## 권장 스프린트 계획

> 의존성 충돌을 피하면서 가장 위험한 것부터 해결하는 순서입니다.

### Sprint 1 — 즉시 (독립 수정, 병렬 작업 가능)

| 항목 | 작업 | 수정 파일 |
|------|------|----------|
| #01 | 원자적 UPDATE로 이중 민팅 차단 | `mint/export/route.ts` |
| #02 | DB UNIQUE 제약 + INSERT 충돌 처리 | Supabase SQL + `webhooks/redeem/route.ts` |
| #04 | `crypto.timingSafeEqual` 적용 | `webhooks/redeem/route.ts` |
| #09 | 에러 메시지 마스킹 | `mint/export/route.ts` |
| #10 | Sui 지갑 주소 정규식 검증 | `inventory/page.tsx` + `mint/export/route.ts` |
| #15 | "DB 롤백 완료됨" 거짓 메시지 수정 | `inventory/page.tsx` |

> **이 6개는 서로 안 겹침.** 동시에 나눠서 작업 가능.
> Sprint 1만 끝내도 P0 2건(#01, #02) + P1 3건(#04, #09, #10)이 해결됨.

### Sprint 2 — 서버 보강 (순서 주의)

| 항목 | 작업 | 수정 파일 | 주의사항 |
|------|------|----------|----------|
| #07 + #08 | network, studio_id 서버 환경변수 고정 | `mint/export/route.ts` → `inventory/page.tsx` | **서버 먼저, 클라이언트 나중** |
| #05 + #06 | `mint_failed` 상태 도입 + 롤백 에러 처리 | `mint/export/route.ts` + `inventory/page.tsx` | **반드시 동시 수정** |
| #19 | `InventoryItem` 타입 정의 | `inventory/page.tsx` | #05와 함께 (status에 `mint_failed` 포함) |
| #14 | metadata 화이트리스트 검증 | `mint/export/route.ts` | 독립 가능 |

### Sprint 3 — 인증 시스템 (가장 큰 변경)

| 항목 | 작업 | 수정 파일 |
|------|------|----------|
| #03 | Supabase Auth 도입 + middleware | 신규 `middleware.ts` + 모든 API route |
| #11 | 인벤토리 API 인증 적용 | `api/inventory/route.ts` |
| #20 | 샘플 API 보호 또는 제거 | `api/inventory/route.ts` |

> **#03이 완료되어야 Sprint 4를 시작할 수 있음.**

### Sprint 4 — 인증 의존 항목

| 항목 | 작업 | 수정 파일 | 선행 조건 |
|------|------|----------|----------|
| #17 | TEST_USER_ID 등 테스트 상수 제거 | `inventory/page.tsx` | #03 완료 필수 |
| #13 | 지갑 주소 Supabase 서버 저장 | DB 스키마 + `inventory/page.tsx` | #03 완료 필수 |
| #18 | Server/Client 컴포넌트 분리 | `inventory/page.tsx` → 분리 | #03 완료 필수 |
| #12 | 웹훅 Replay 방어 | `webhooks/redeem/route.ts` | ForTem 측 타임스탬프 지원 확인 |
| #16 | `.single()` → `.maybeSingle()` | `webhooks/redeem/route.ts` | #02 적용 시 자동 해결 |

---

## 개발자 전달 가이드

### 전달 시 핵심 요청 사항

이 문서를 전달할 때, 아래 3가지를 명확히 전달해 주세요:

**1. 작업 범위와 기대치**

> "외부 수석 개발자 관점에서 코드 리뷰를 받았습니다.
> 총 20건의 피드백이 P0~P3 등급으로 정리되어 있습니다.
> **P0 3건은 배포 차단 사유**이므로 반드시 먼저 해결해 주세요."

**2. 의존성 준수 요청**

> "문서 중간에 '수정 항목 간 의존성 분석' 섹션이 있습니다.
> 충돌 지점이 4곳 있으니, **스프린트 계획 순서대로** 작업해 주세요.
> 특히 Sprint 3(인증)이 끝나기 전에 Sprint 4 항목(#17, #13, #18)을 건드리면
> 코드가 꼬이니 순서를 꼭 지켜주세요."

**3. 완료 확인 기준**

> "각 항목을 수정한 뒤, 아래 체크리스트로 검증해 주세요."
>
> - [ ] #01: 동일 아이템에 대해 Export 버튼 연타 시 409 에러 반환 확인
> - [ ] #02: Supabase에서 `redeem_tx_hash` UNIQUE 제약 확인 + 같은 tx_hash로 웹훅 2회 전송 시 1건만 INSERT 확인
> - [ ] #03: 인증 토큰 없이 API 호출 시 401 반환 확인
> - [ ] #04: 서명 비교에 `timingSafeEqual` 사용 확인 (코드 리뷰)
> - [ ] #05: 민팅 실패 시 DB 상태가 `mint_failed`인지 확인 (`available`이면 미수정)
> - [ ] #06: 롤백 UPDATE 실패 시 에러 로그 출력 확인
> - [ ] #07: `.env.local`에 `FORTEM_NETWORK` 추가 + body의 network 무시 확인
> - [ ] #08: `.env.local`에 `FORTEM_STUDIO_ID` 추가 + body의 studio_id 무시 확인
> - [ ] #09: 500 에러 응답에 내부 에러 메시지가 포함되지 않는지 확인
> - [ ] #10: "abc123" 같은 잘못된 주소 입력 시 클라이언트/서버 모두 거부 확인

### 추가 질문 요청

> "수정하다가 설계 판단이 필요한 지점이 있으면 바로 공유해 주세요.
> 특히 아래 사안은 논의가 필요할 수 있습니다:"
>
> - #03 인증 방식: Supabase Auth vs 자체 JWT vs 외부 OAuth 중 어떤 것을 쓸지
> - #05 배치 잡: Vercel Cron vs 외부 스케줄러(예: Supabase Edge Functions) 중 어떤 것을 쓸지
> - #12 Replay 방어: ForTem SDK가 타임스탬프 헤더를 제공하는지 확인 필요
