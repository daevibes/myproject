# CLAUDE.md (Onboarding & Mental Model)

## 🛠 Commands
- **Dev**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint`

## 🧠 Project Mental Model
2D Survivor game on **Sui (via ForTem SDK)**.
1. **Flow**: In-game Drop -> Supabase Sync (`item_uid` UNIQUE) -> `/inventory` Export -> ForTem `items.create`.
2. **Identity**: Use `game_user_id` (UUID) only. No Web2 emails/names.
3. **State**: **Zustand** is the source of truth for both React (UI) & Phaser (Game). Use `useGameStore.getState()` inside Phaser systems.

## 📁 Key Directories
- `/game`: Phaser logic (Scenes, Systems, Entities).
- `/app/api`: Backend (Inventory, Minting, Webhooks).
- `/lib/store`: Zustand `useGameStore`.
- `/plan`: Phase completion & roadmap.

## ⚠️ Critical Rules
- **SDK**: Use `apiKey` (not `secretKey`) and `items.create` (not `mint.exportItem`).
- **Sync**: Optimistic UI in Frontend. Background async `/api/inventory` on pickup.
- **Wallet**: User saves wallet address manually. No auto-connect required for MVP.

## 🚧 Current Status / Blockers
- **ForTem Collection**: NOT yet registered in ForTem Dashboard. Expect `items.create` to fail if actually called. Use mock responses or focus on logic for now.

---
*Refer to `plan/phase4.md` for recent architecture changes.*
