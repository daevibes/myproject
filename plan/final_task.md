본 문서의 항목들은 개발 편의를 위해 의도적으로 보류되었으며, Phase 2(배포 전 인증 도입 단계)에서 반드시 해결해야 합니다.

## 1. 인증 및 인가 (Authentication & Authorization)
- **[#03] 민팅 API 호출자 신원 검증**: 
  - 현재: `game_user_id`를 Body에서 받는 대로 신뢰함.
  - 수정: Supabase Auth 세션 토큰을 검증하여 "요청자 == 아이템 소유자"임을 서버에서 확정해야 함.
- **[#11] 인벤토리 조회 API 보호**:
  - 현재: URL 파라미터에 `game_user_id`만 넣으면 누구나 타인의 인벤토리 조회 가능.
  - 수정: 인증된 유저 본인의 데이터만 반환하도록 Middleware 또는 API 로직 수정.

## 2. 데이터 저장 방식 개선 (Data Persistence)
- **[#13] 지갑 주소의 서버사이드 저장**:
  - 현재: 브라우저 `localStorage`에만 저장 (기기 변경 시 정보 유실).
  - 수정: Supabase `profiles` 테이블에 지갑 주소를 저장하여 어떤 기기에서 접속해도 유지되도록 개선.

## 3. 코드 정리 및 최적화 (Cleanup & Optimization)
- **[#17] 테스트용 하드코딩 상수 제거**:
  - 대상: `TEST_USER_ID`, `TEST_STUDIO_ID`, `NETWORK` 등.
  - 수정: 실제 로그인 세션 유저 ID와 서버 환경변수(`.env.local`)로 전면 교체.
- **[#18] Next.js 컴포넌트 구조 최적화 (Server/Client 분리)**:
  - 현재: `inventory/page.tsx` 전체가 클라이언트 컴포넌트(`"use client"`).
  - 수정: 초기 데이터 페칭은 서버 컴포넌트에서 수행하고, UI 상호작용만 클라이언트 컴포넌트로 분리하여 초기 로딩 속도(LCP) 개선.

---
## Phase 2 진입 시점
- Phaser 4 게임의 핵심 메카닉 개발 완료 후.
- ForTem 메인넷 온보딩 신청 직전.
- 실제 유저 가입(로그인) 기능을 붙이는 시점.
