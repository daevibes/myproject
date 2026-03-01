# Phase 5: 신규 6슬롯 장비 및 스탯 기획 (아이템 리스트)

현재 캐릭터의 슬롯이 6개(Head, Body, Legs, Shoes, RightHand, LeftHand)로 확장됨에 따라, 각 부위별 아이템 이름과 주요 능력치, 그리고 무기의 양손(`isTwoHanded`) 여부를 다음과 같이 정의합니다. 이 리스트는 `game/config/items.ts` 코드에 그대로 반영될 기준 자료입니다.

## 🌟 1. 무기류 (Weapons)
무기는 플레이어의 주 공격력(Attack)에 가장 큰 영향을 미치며, 무기의 종류에 따라 발동되는 궁극기가 달라집니다. 양손 무기(`isTwoHanded: true`)는 장착 시 추가 스탯 보정이 붙습니다.

### 🗡️ 한손검 (Sword - 궁극기: 일직선 광선)
* `RightHand` 또는 `LeftHand` 중 빈 곳에 착용. 양손에 각각 차면 '쌍칼' 궁극기(휠윈드) 활성화.
* **[Common] 녹슨 철검 (Rusty Sword)**
  * **능력치**: Attack +10
  * **특징**: 기본적인 공격용 무기. 특별한 장점 없음.
* **[Rare] 기사의 장검 (Knight's Longsword)**
  * **능력치**: Attack +25, Speed +10
  * **특징**: 무난한 속도와 준수한 파괴력을 갖춘 정규 기사용 검.
* **[Epic] 💎 빛의 성검 (Excalibur - 추후 NFT 민팅 가능)**
  * **능력치**: Attack +60, HP +100
  * **특징**: 보스전 시 추가 데미지를 기대할 수 있는 전설의 무기. 강력한 오라.

### 🛡️ 방패 (Shield - 방어력 및 생존)
* `RightHand` 또는 `LeftHand` 중 빈 곳에 착용. 공격력 대신 막강한 생존력을 제공.
* **[Common] 낡은 나무 방패 (Wooden Shield)**
  * **능력치**: Defense +10
  * **특징**: 초반을 버티게 해주는 든든한 나무 판때기.
* **[Rare] 철제 타워 실드 (Iron Tower Shield)**
  * **능력치**: Defense +30, HP +50
  * **특징**: 플레이어의 몸 절반을 가리는 거대한 철방패.
* **[Epic] 💎 이지스의 방패 (Aegis Shield - 추후 NFT 민팅 가능)**
  * **능력치**: Defense +80, HP +200, Speed -10
  * **특징**: 적의 데미지를 극단적으로 줄여주나 무게로 인해 약간의 이속 감소.

### 🔱 양손창 (Spear - 궁극기: 360도 넓은 충격파)
* **`isTwoHanded: true`**. 장착 시 `RightHand`와 `LeftHand` 모두 점유. 공수 밸런스가 뛰어나고 기본 리치가 약간 김.
* **[Common] 조잡한 창 (Crude Spear)**
  * **능력치**: Attack +15, Defense +5
  * **특징**: 리치가 무난한 기본 양손 무기.
* **[Rare] 미스릴 할버드 (Mithril Halberd)**
  * **능력치**: Attack +40, Defense +15
  * **특징**: 베기와 찌르기 모두 가능한 다목적 장창.
* **[Epic] 💎 용기사의 창 (Dragon Slayer Spear - 추후 NFT 민팅 가능)**
  * **능력치**: Attack +90, Defense +30
  * **특징**: 파괴적인 데미지를 자랑하는 전설의 명창. 

---

## 🛡️ 2. 방어구류 (Armors)
총 4개의 부위(Head, Body, Legs, Shoes)로 나뉘며 각 부위마다 특화된 스탯 보너스를 줍니다.

### 🪖 머리 (Head - 체력 및 방어력 코어)
* **[Common] 낡은 가죽 모자 (Leather Cap)**: HP +20, Defense +2
* **[Rare] 강철 투구 (Steel Helm)**: HP +60, Defense +10
* **[Epic] 💎 여신의 티아라 (Goddess Tiara - 추후 NFT 민팅 가능)**: HP +150, Defense +25, Attack +5

### 👕 상의 (Body - 극대화된 방어력)
* **[Common] 천 옷 (Cloth Tunic)**: Defense +5, HP +10
* **[Rare] 사슬 갑옷 (Chainmail)**: Defense +20, HP +50
* **[Epic] 💎 용의 비늘 갑옷 (Dragon Scale Armor - 추후 NFT 민팅 가능)**: Defense +60, HP +200

### 👖 하의 (Legs - 밸런스형 스탯)
* **[Common] 낡은 바지 (Old Pants)**: Defense +3, Speed +5
* **[Rare] 기사의 각반 (Knight's Greaves)**: Defense +15, Speed +10
* **[Epic] 💎 성기사의 전투용 바지 (Paladin's Leggings - 추후 NFT 민팅 가능)**: Defense +40, HP +100, Speed +20

### 🥾 신발 (Shoes - 이동속도 극대화)
생존 게임에서 몬스터의 포위를 피하기 위한 "이동속도(Speed)"가 가장 많이 붙는 핵심 부위.
* **[Common] 짚신 (Straw Shoes)**: Speed +15
* **[Rare] 장인의 가죽 부츠 (Master's Leather Boots)**: Speed +40, Defense +5
* **[Epic] 💎 페가수스의 깃털 구두 (Pegasus Boots - 추후 NFT 민팅 가능)**: Speed +80, 최상급 기동력, Defense +15

---

## 💡 아이템 속성(Entity) 설계 반영 사항
* `in_game_item_id`는 명확하게 영문(Snake-case) 결합으로 정의합니다. (예: `sword_rare_knight`, `shoes_epic_pegasus`)
* 6개의 슬롯은 배열이 아닌 직관적인 Record(Object) 형태로 Zustand 스토어에 장착 상태가 격리되어야 합니다.
  ```typescript
  type EquipmentSlots = {
    Head: Item | null;
    Body: Item | null;
    Legs: Item | null;
    Shoes: Item | null;
    RightHand: Item | null;
    LeftHand: Item | null;
  };
  ```
