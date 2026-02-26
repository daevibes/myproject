# ForTem 프로젝트 개발 규칙

## 1. 프로젝트 개요
- Stack: Next.js (App Router), Phaser 4, Supabase, Zustand
- SDK: @fortemlabs/sdk-js
- 목적: ForTem의 Sui 기반 Minting(Export) 및 Redemption(Import) 시스템 구축

## 2. 핵심 규칙
- **Web2 식별자 금지**: 이메일, 이름 대신 `studio_id`와 `game_user_id`(UUID)만 사용한다.
- **아이템 흐름**: 
  1. 게임 내 아이템을 NFT로 민팅(Export) -> `/api/fortem/mint`
  2. ForTem에서 리딤(Redeem) 시 웹훅 수신 -> `/api/webhooks/fortem/redeem` -> 인게임 아이템 지급
- **상태 관리**: Zustand를 사용하여 Phaser 게임과 Next.js UI 간의 지갑/인벤토리 상태를 동기화한다.

## 3. 참고 문서 (반드시 로직에 반영)
- Docs: https://docs.fortem.gg/
- Blog (Minting): https://www.deps.ink/blog/supabase-edge-functions-for-nft-minting
- Blog (Redeem): https://www.deps.ink/blog/nft-redemption-flow
