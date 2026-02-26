<!-- fortem_api_guide.md -->
# ForTem API Integration Guide (Minting & Redemption Flow)

## 1. Overview
본 문서는 Next.js 기반 미니 게임에서 ForTem SDK/API를 활용하여 **인게임 아이템의 NFT 변환(Export)** 및 **NFT의 인게임 아이템 전환(Redeem)** 생태계를 구축하기 위한 가이드입니다.
기존 Web2 식별자(이메일, 이름 등)를 배제하고, 오직 `studio_id`와 `game_user_id`만을 사용하여 지갑 생성 및 자산 이동을 처리합니다.

## 2. Core Identifiers (필수 식별자)
모든 ForTem API 요청에는 다음 두 가지 식별자가 필수적으로 포함되어야 합니다.
* `studio_id` (String): ForTem 대시보드에서 발급받은 게임 스튜디오 고유 식별자
* `game_user_id` (String): 게임 데이터베이스(Supabase)에서 관리하는 유저의 고유 식별자 (UUID 형식 권장)

## 3. API Endpoints (Next.js API Routes Proxy & Webhook)

### 3.1. 지갑 조회 및 생성 (Wallet Provisioning)
게임 진입 시, 해당 `game_user_id`에 연결된 Sui 지갑 주소를 조회하거나 생성합니다.

* **Endpoint**: `POST /api/fortem/wallet/init`
* **Request Body**:
  ```json
  {
    "studio_id": "std_12345abcd",
    "game_user_id": "usr_98765xyz"
  }

  
  

  }  