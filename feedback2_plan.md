# ForTem Feedback 2 Integration Plan

This plan documents the changes required to address the 5 new defects identified in `feedback2.md`.

## Proposed Changes

### Backend API (Minting)
Updates to handle failed mint retry logic, correctly map response keys, and properly process metadata from the client.

- **NEW-1: "다시 시도" 버튼 작동 불가 (Retry Logic)**
  - Update the atomic lock query to allow items that are either `status: 'available'` OR `status: 'mint_failed'`.
  - Modification: `.eq('status', 'available')` -> `.in('status', ['available', 'mint_failed'])`

- **NEW-3: 응답 키 불일치 (Response Mismatch)**
  - Update the success response payload to send `transaction_id` instead of `tx` so the client UI parses it correctly.

- **NEW-4: metadata 필드 불일치 (Metadata Unification)**
  - Extract `attributes` directly from the client's payload.

### Backend API (Webhook)
Updates to prevent crashes during signature verification and ensure application errors are logged.

- **NEW-2: `timingSafeEqual` 길이 체크 부재 (Server Crash Risk)**
  - Compare `expectedBuf.length` and `signatureBuf.length` before calling `timingSafeEqual`. Return 403 if they don't match.

- **NEW-5: 웹훅 에러 로그 누락 (Missing Error Log)**
  - Add explicit error logging in the global catch block so webhook failures can be diagnosed.
