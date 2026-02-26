# Feedback 2 기획 검증 리포트

> **점검일:** 2026-02-26
> **점검 대상:** `feedback2_plan.md`, `feedback2_tasks.md`
> **대조 파일:** `mint/export/route.ts`, `webhooks/fortem/redeem/route.ts`

---

## 검증 결과 요약

| 항목 | 기획 판정 | 조치 |
|------|:---------:|------|
| NEW-1 | **OK** | 그대로 진행 |
| NEW-2 | **이미 완료** | tasks 체크 처리만 |
| NEW-3 | **OK** | 그대로 진행 |
| NEW-4 | **보완 필요** | 화이트리스트 필터링 추가 명시 |
| NEW-5 | **이미 완료** | tasks 체크 처리만 |

---

## 상세

### NEW-1. "다시 시도" 버튼 — OK, 그대로 진행

기획: `.eq('status', 'available')` → `.in('status', ['available', 'mint_failed'])`

롤백 시 `is_minted: false`로 설정되므로 기존 `.eq('is_minted', false)` 조건과 충돌 없음. `.in()` 문법도 Supabase 정상 지원. **이대로 진행 가능.**

---

### NEW-2. `timingSafeEqual` 길이 체크 — 이미 코드에 반영됨

`webhooks/fortem/redeem/route.ts` 22~26행에 아래 코드가 이미 적용되어 있음:

```typescript
const expectedBuf = Buffer.from(expected, 'hex');
const signatureBuf = Buffer.from(signature, 'hex');
if (expectedBuf.length !== signatureBuf.length || !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

길이 체크 + hex 인코딩 모두 정확. **tasks에서 완료 처리만 하면 됨.**

---

### NEW-3. 응답 키 불일치 — OK, 그대로 진행

기획: 서버 응답을 `tx` → `transaction_id`로 변경

클라이언트(`data.transaction_id`)를 건드릴 필요 없이 서버 1줄 수정으로 해결. **이대로 진행 가능.**

---

### NEW-4. metadata 필드 불일치 — 보완 필요

기획 원문:
> Extract `attributes` directly from the client's payload.

**문제:** 이대로 하면 `metadata.attributes`를 그대로 ForTem에 전달하게 되어, 기존 #14(metadata 화이트리스트) 보안 조치를 무효화함. 클라이언트가 `attributes: [{ trait_type: "Exploit", value: "<script>..." }]` 같은 악의적 데이터를 주입할 수 있음.

**기획에 아래 내용 추가 필요:**

> Extract `attributes` from the client's payload, **filtering only allowed `trait_type` values** (e.g., "Attack", "Defense", "HP") and **forcing `value` to Number type**.

수정 코드 예시:

```typescript
const ALLOWED_TRAITS = ['Attack', 'Defense', 'HP', 'Speed'];
const safeMetadata = {
    name: metadata?.name || in_game_item_id,
    attributes: Array.isArray(metadata?.attributes)
        ? metadata.attributes
            .filter((a: any) => ALLOWED_TRAITS.includes(a.trait_type))
            .map((a: any) => ({ trait_type: String(a.trait_type), value: Number(a.value) || 0 }))
        : []
};
```

---

### NEW-5. 웹훅 에러 로그 — 이미 코드에 반영됨

`webhooks/fortem/redeem/route.ts` 40행에 아래 코드가 이미 적용되어 있음:

```typescript
console.error('[WEBHOOK_ERROR]:', err.message);
```

**tasks에서 완료 처리만 하면 됨.**

---

## 남은 작업 정리

실제로 개발자가 수정해야 할 항목은 **3건**입니다:

| 순위 | 항목 | 파일 | 작업 |
|:----:|------|------|------|
| 1 | NEW-1 | `mint/export/route.ts` 27행 | `.eq('status', 'available')` → `.in('status', ['available', 'mint_failed'])` |
| 2 | NEW-3 | `mint/export/route.ts` 50행 | `tx` → `transaction_id` |
| 3 | NEW-4 | `mint/export/route.ts` 18행 | `safeMetadata`를 `ALLOWED_TRAITS` 화이트리스트 기반 `attributes` 추출로 교체 |

> 3건 모두 `mint/export/route.ts` 한 파일 안에서 서로 다른 행을 수정하므로 충돌 없이 동시 작업 가능.
