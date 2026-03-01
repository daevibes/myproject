# Antigravity Agent Rules for ForTem Project

## 1. Project Goal
- Next.js 14+ (App Router) & Phaser 4 기반의 Web3 미니 게임 개발.
- ForTem SDK를 사용하여 게임 내 아이템을 NFT로 Export(Minting)하고, 외부 거래 후 다시 게임으로 Redeem(Import)하는 순환 경제 구현.

## 2. Tech Stack
- Frontend: Next.js, Tailwind CSS
- Game Engine: Phaser 4
- Backend: Next.js API Routes (Server-side Proxy), Supabase (DB & Auth)
- State Management: Zustand (Phaser와 React UI 간 상태 공유용)
- Web3: @fortemlabs/sdk-js (Sui Network)

## 3. Core Development Rules (중요)
- **Identity**: 이메일/이름 등 Web2 개인정보는 절대 사용하지 않는다. 오직 `studio_id`와 `game_user_id`(UUID)만 식별자로 사용한다.
- **Security**: ForTem API Secret Key는 반드시 서버(`app/api`)에서만 사용하며, 클라이언트에 절대 노출하지 않는다.
- **Environment**: 개발 시에는 반드시 `sui-testnet` 환경을 타겟으로 작동하게 코드를 작성한다.
- **Item Flow**:
    - 인게임 -> NFT 변환: `/api/fortem/mint/export` 호출 (Supabase에서 인게임 소유 검증 필수).
    - NFT -> 인게임 변환: ForTem Webhook (`/api/webhooks/fortem/redeem`) 수신 후 DB에 아이템 지급.
- **Phaser Integration**: `game/bridge.ts`를 통해 Phaser 이벤트와 Zustand Store를 연결하여 지갑 잔액과 인벤토리를 실시간 업데이트한다.

## 4. Reference URLs (코딩 시 참고)
- Docs: https://docs.fortem.gg/
- Blog: https://www.deps.ink/blog/supabase-edge-functions-for-nft-minting
- Blog: https://www.deps.ink/blog/multi-step-minting-ui-in-phaser
- Blog: https://www.deps.ink/blog/nft-redemption-flow