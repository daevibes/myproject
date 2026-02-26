---
name: ForTem Webhook Testing
description: ngrok으로 로컬 웹훅 테스트 환경을 구축하고 ForTem 리딤을 시뮬레이션하는 방법
---

# ForTem Webhook Testing

## 로컬 웹훅 테스트가 필요한 이유
ForTem 서버가 리딤(Redeem) 완료 신호를 보내려면 우리 서버의 URL이 **인터넷에서 접근 가능**해야 합니다.
`localhost:3000`은 외부에서 접근 불가하므로, `ngrok` 등의 터널링 도구를 사용합니다.

## ngrok 설정

```bash
# 1. ngrok 설치 (Windows)
choco install ngrok
# 또는 https://ngrok.com/ 에서 직접 다운로드

# 2. 계정 연동 (무료 가입 후)
ngrok config add-authtoken YOUR_AUTH_TOKEN

# 3. 로컬 3000번 포트를 외부에 노출
ngrok http 3000
```

실행하면 다음과 같은 URL이 발급됩니다:
```
Forwarding  https://abc123.ngrok-free.app → http://localhost:3000
```

이 URL을 ForTem 대시보드의 Webhook URL에 등록:
```
https://abc123.ngrok-free.app/api/webhooks/fortem/redeem
```

## curl로 웹훅 시뮬레이션

ForTem 서버가 보내는 요청을 수동으로 재현합니다.

```bash
# 1. 서명 생성 (Node.js 스크립트)
node -e "
const crypto = require('crypto');
const body = JSON.stringify({
  game_user_id: 'usr_test_12345',
  in_game_item_id: 'sword_lv50',
  redeem_tx_hash: 'test_tx_' + Date.now(),
  nft_token_id: 'nft_test_001'
});
const sig = crypto.createHmac('sha256', 'YOUR_FORTEM_SECRET_KEY').update(body).digest('hex');
console.log('Body:', body);
console.log('Signature:', sig);
"

# 2. curl로 웹훅 전송
curl -X POST http://localhost:3000/api/webhooks/fortem/redeem \
  -H "Content-Type: application/json" \
  -H "x-fortem-signature: {위에서 생성된 signature}" \
  -H "x-fortem-timestamp: $(date +%s)" \
  -d '{위에서 생성된 body}'
```

## 테스트 시나리오 체크리스트

| 시나리오 | 기대 결과 |
|----------|-----------|
| 정상 리딤 요청 | `200 { status: 'success' }` + DB에 아이템 추가 |
| 같은 `redeem_tx_hash`로 2번 전송 | 두 번째는 `200 { status: 'already_processed' }` |
| 서명 없이 전송 | `401 { error: 'Missing signature' }` |
| 잘못된 서명으로 전송 | `403 { error: 'Invalid signature' }` |
| 짧은 서명(`abc`)으로 전송 | `403 { error: 'Invalid signature' }` (크래시 없음) |
| 5분 이상 된 타임스탬프 | `403 { error: 'Timestamp expired' }` |

## 주의사항
- ngrok 무료 티어는 URL이 재시작 시마다 변경됨 → ForTem 대시보드에서 업데이트 필요
- 테스트 시 `.env.local`의 `FORTEM_SECRET_KEY`와 curl 스크립트의 키가 **동일**해야 함
- Supabase DB에 `unique_redeem_tx_hash` 제약 조건이 적용되어 있어야 멱등성 테스트 가능
