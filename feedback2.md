# 수정 후 재검증 리포트 — ForTem Web3 게임 인프라

> **점검일:** 2026-02-26
> **선행 문서:** `feedback.md` (20건 최초 피드백)
> **의도적 보류:** #03, #11 (인증 — Phase 2), #13 (지갑 서버 저장 — 프로필 기능 시), #17 (테스트 상수 — 인증 후)

---

## 합격 항목 (14건)

| # | 항목 | 판정 | 확인 근거 |
|---|------|:----:|----------|
| 01 | 원자적 UPDATE | PASS | `mint/export/route.ts` 21~31행 — 단일 UPDATE + WHERE 조건으로 레이스 차단 |
| 02 | UNIQUE 멱등성 | PASS | `webhooks/redeem/route.ts` 28~34행 — SELECT 제거, INSERT → `23505` 충돌 처리 |
| 05 | `mint_failed` 상태 | PASS | `mint/export/route.ts` 56행 — 롤백 시 `available` 대신 `mint_failed` 적용 |
| 06 | 롤백 에러 처리 | PASS | `mint/export/route.ts` 58행 — `rbErr` 체크 + 로그 출력 |
| 07 | network 서버 고정 | PASS | `mint/export/route.ts` 37행 — `process.env.FORTEM_NETWORK` 사용 |
| 08 | studio_id 서버 고정 | PASS | `mint/export/route.ts` 41행 — `process.env.FORTEM_STUDIO_ID` 사용 |
| 09 | 에러 메시지 마스킹 | PASS | `mint/export/route.ts` 60행 — `'MINT_PROCESS_FAILED'` 일반 메시지 반환 |
| 10 | 지갑 주소 검증 | PASS | 클라이언트(`page.tsx` 40행) + 서버(`route.ts` 15행) 양쪽 정규식 적용 |
| 12 | Replay 방어 | PASS | `webhooks/redeem/route.ts` 16~18행 — 타임스탬프 5분 경과 시 거부 |
| 14 | metadata 화이트리스트 | PASS | `mint/export/route.ts` 18행 — `safeMetadata`로 필드 제한 |
| 15 | UX 메시지 | PASS | `page.tsx` 84행 — "롤백 완료됨" → "상태 복구 중" |
| 16 | `.single()` 문제 | PASS | #02에서 SELECT 자체 제거로 자동 해결 |
| 19 | TypeScript 타입 | PASS | `types/inventory.ts` — `InventoryItem` 인터페이스 + `mint_failed` 포함 |
| 20 | 샘플 API 보호 | PASS | `api/inventory/route.ts` 29~31행 — production 환경 체크 추가 |

---

## 신규 발견 결함 (5건) — 수정 과정에서 새로 생긴 문제

### NEW-1. [HIGH] "다시 시도" 버튼이 절대 작동하지 않는다

서버와 UI 사이에 **상태 불일치**가 있습니다.

서버 쪽 원자적 UPDATE는 `status: 'available'`인 아이템만 허용합니다:

- **파일:** `mint/export/route.ts` 27행
- **코드:** `.eq('status', 'available')`

그런데 UI에서는 `mint_failed` 상태일 때 "다시 시도" 버튼을 활성화합니다:

- **파일:** `inventory/page.tsx` 171~176행
- **코드:** `disabled` 조건에 `mint_failed`가 없어서 클릭 가능하지만, 서버에서는 `status !== 'available'`이므로 항상 409 에러 반환

**유저 영향:** "다시 시도"를 누를 수 있지만 영원히 실패합니다.

**해결 방법 (둘 중 택 1):**

**(A) 서버에서 mint_failed도 재시도 허용 (권장):**

```typescript
// mint/export/route.ts — WHERE 조건에 mint_failed도 포함
.or('status.eq.available,status.eq.mint_failed')
.eq('is_minted', false)
```

**(B) 별도 "상태 초기화" API를 만들어서 mint_failed → available로 리셋 후 재시도**

---

### NEW-2. [HIGH] `timingSafeEqual`에 길이 체크가 없다 — 서버 크래시 가능

- **파일:** `webhooks/redeem/route.ts` 22행
- **현상:** `crypto.timingSafeEqual`은 두 Buffer 길이가 다르면 예외를 던짐. 공격자가 짧은 서명(`x-fortem-signature: "abc"`)을 보내면 throw 발생 → catch에서 500 반환
- **문제점:**
  - 403(서명 틀림)이 아닌 500(서버 에러)을 반환하므로 ForTem 서버가 재시도를 계속할 수 있음
  - 에러 로그가 과도하게 쌓임

**수정:**

```typescript
const expectedBuf = Buffer.from(expected, 'hex');
const signatureBuf = Buffer.from(signature, 'hex');
if (expectedBuf.length !== signatureBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

### NEW-3. [MEDIUM] 응답 키 불일치 — 클라이언트가 트랜잭션 ID를 못 읽는다

- **서버 응답:** `mint/export/route.ts` 50행 — `{ status: 'success', tx: mintResponse.transactionId }`
- **클라이언트 읽기:** `inventory/page.tsx` 78행 — `data.transaction_id`

서버는 `tx`로 보내고, 클라이언트는 `transaction_id`를 읽습니다.

**유저 영향:** 민팅 성공해도 화면에 "성공! 트랜잭션: undefined" 표시

**수정 (둘 중 하나를 맞춤):**

- 서버: `tx` → `transaction_id`로 변경
- 또는 클라이언트: `data.transaction_id` → `data.tx`로 변경

---

### NEW-4. [MEDIUM] metadata 클라이언트-서버 필드 불일치

- **클라이언트:** `inventory/page.tsx` 67행 — `{ name: ..., attributes: [{ trait_type: "Attack", value: 100 }] }`
- **서버 추출:** `mint/export/route.ts` 18행 — `{ name: metadata?.name, attack: metadata?.attack }`

클라이언트는 `attributes` 배열로 보내는데, 서버는 `metadata.attack`을 꺼냅니다. `metadata.attack`은 `undefined`이므로 ForTem에 전달되는 metadata에 **공격력 정보가 항상 빠집니다.**

**수정:** 클라이언트와 서버의 metadata 구조를 통일해야 합니다.

```typescript
// 방법 A: 클라이언트를 서버에 맞춤
metadata: { name: `Item ${itemId}`, attack: 100 }

// 방법 B: 서버를 클라이언트에 맞춤 (NFT 표준 형식)
const safeMetadata = {
    name: metadata?.name || in_game_item_id,
    attributes: Array.isArray(metadata?.attributes)
        ? metadata.attributes.filter((a: any) => ['Attack', 'Defense'].includes(a.trait_type))
        : []
};
```

---

### NEW-5. [LOW] 웹훅 catch에서 에러 로그가 없다

- **파일:** `webhooks/redeem/route.ts` 37~38행
- **현상:** catch 블록에 `console.error`가 없어서 DB 연결 실패 같은 심각한 문제를 디버깅할 수 없음

**수정:**

```typescript
} catch (err: any) {
    console.error('[WEBHOOK_ERROR]:', err.message);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
}
```

---

## 최종 요약

| 구분 | 건수 | 상태 |
|------|:----:|------|
| 합격 | 14건 | 잘 고쳐짐 |
| 의도적 보류 | 4건 | #03, #11, #13, #17 (Phase 2로 이관) |
| 신규 발견 | 5건 | 수정 과정에서 새로 생긴 불일치/누락 |

---

## 신규 결함 수정 우선순위

| 순위 | 항목 | 시급도 | 예상 작업량 |
|:----:|------|:------:|:----------:|
| 1 | NEW-1: "다시 시도" 버튼 작동 불가 | HIGH | 서버 WHERE 조건 1줄 수정 |
| 2 | NEW-2: timingSafeEqual 길이 체크 | HIGH | 3줄 수정 |
| 3 | NEW-3: 응답 키 `tx` vs `transaction_id` | MEDIUM | 1줄 수정 |
| 4 | NEW-4: metadata 필드 불일치 | MEDIUM | 클라이언트 또는 서버 1곳 수정 |
| 5 | NEW-5: 웹훅 에러 로그 누락 | LOW | 1줄 추가 |

> **NEW-1 ~ NEW-3은 유저에게 직접 보이는 문제**이므로 우선 수정 필요합니다.
