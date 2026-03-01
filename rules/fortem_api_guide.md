# ForTem API Integration Guide (Minting & Redemption)

## 1. Wallet Initialization
- **Endpoint**: `POST /api/fortem/wallet/init`
- **Request Body**:
  ```json
  {
    "studio_id": "std_12345abcd",
    "game_user_id": "usr_98765xyz",
    "network": "sui-testnet"
  }
Logic: game_user_id를 기반으로 ForTem Sui 지갑 주소를 조회하거나 백그라운드에서 생성한다.

2. Export Item (Minting)
Endpoint: POST /api/fortem/mint/export
Request Body:
code
JSON
{
  "studio_id": "std_12345abcd",
  "game_user_id": "usr_98765xyz",
  "network": "sui-testnet",
  "in_game_item_id": "sword_001",
  "metadata": { "name": "Dragon Sword", "attack": 100 }
}
Logic: 서버(API)에서 유저의 인게임 아이템 소유 여부를 DB에서 먼저 확인한 후, 인게임 아이템을 삭제/잠금 처리하고 ForTem SDK를 호출하여 NFT 민팅을 실행한다.

3. Redeem Item (Import via Webhook)
Endpoint: POST /api/webhooks/fortem/redeem
Headers: x-fortem-signature
Request Body (from ForTem):
code
JSON
{
  "studio_id": "std_12345abcd",
  "game_user_id": "usr_98765xyz",
  "network": "sui-testnet",
  "nft_token_id": "10024",
  "in_game_item_id": "sword_001",
  "redeem_tx_hash": "0xRedeemHash..."
}
Logic: 유저가 ForTem에서 NFT를 리딤했을 때 호출되는 S2S 웹훅. 헤더의 서명을 검증한 뒤, 유저의 인게임 인벤토리에 아이템을 복구(지급)한다.