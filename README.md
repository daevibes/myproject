### 3. `redemption_logic.md`

```markdown
# NFT Redemption Logic Flow

## 1. User Story
- 유저는 ForTem 마켓플레이스나 지갑 앱에서 자신이 소유한 NFT 아이템의 'Redeem(사용하기)' 버튼을 누른다.
- 이 과정에서 해당 NFT는 블록체인 상에서 소각(Burn)되거나 게임 스튜디오의 금고로 전송(Lock)된다.

## 2. Server-to-Server Flow (S2S)
1. **Webhook Event**: ForTem 서버가 트랜잭션 성공을 감지하면 우리 Next.js 서버의 엔드포인트(`/api/webhooks/fortem/redeem`)로 웹훅을 쏜다.
2. **Signature Verification**: 우리 서버는 헤더의 `x-fortem-signature`를 ForTem Secret Key로 해싱 검증하여 해커의 가짜 요청을 차단한다.
3. **Database Update**: 
   - `game_user_id`가 유효한지 확인한다.
   - 전달받은 `in_game_item_id`를 해당 유저의 Supabase 인벤토리(Inventory) 테이블에 Insert 한다.
4. **Real-time Notify**: Zustand State를 갱신하여 Phaser 게임 화면에 "아이템이 수령되었습니다!" 알림을 띄운다.

## 3. Exception Handling & Idempotency
- **중복 지급 방지**: DB 업데이트 시 `redeem_tx_hash`를 고유키(Unique Key)로 저장하여, 네트워크 재시도로 동일한 웹훅이 여러 번 오더라도 아이템이 중복 지급되지 않도록 방어한다.
- **유저 불일치**: `game_user_id`가 DB에 존재하지 않으면 지급을 중단하고 400 에러를 반환하여 ForTem 측에 실패를 알린다.