import * as Phaser from 'phaser';
import { useGameStore, OwnedItem } from '@/lib/store/useGameStore';
import { EQUIP_SLOTS, RARITY_COLORS } from '../config/items';
import {
    VIEWPORT_WIDTH,
    VIEWPORT_HEIGHT,
    INVENTORY_MAX_SLOTS,
    PLAYER_HP,
    PLAYER_ATK,
} from '../config/constants';

export class LobbyScene extends Phaser.Scene {
    private selectedItem: OwnedItem | null = null;
    private selectionUI: Phaser.GameObjects.GameObject[] = [];
    private selectedHighlight: Phaser.GameObjects.Arc | null = null;
    // 선택 해제 시 원래 테두리 복원용 (장착 중 아이템 = 초록 테두리)
    private selectedHighlightOriginalStroke: { width: number; color: number } | null = null;

    constructor() {
        super('LobbyScene');
    }

    create() {
        this.selectedItem = null;
        this.selectionUI = [];
        this.selectedHighlight = null;
        this.selectedHighlightOriginalStroke = null;

        this.cameras.main.setBackgroundColor(0x1a1a2e);

        const halfW = VIEWPORT_WIDTH / 2;
        const leftCx = halfW / 2;
        const rightCx = halfW + halfW / 2;

        // 구분선
        this.add.rectangle(halfW, VIEWPORT_HEIGHT / 2, 2, VIEWPORT_HEIGHT - 40, 0x333366);

        const state = useGameStore.getState();

        // ========== 왼쪽 50%: 타이틀 + 캐릭터 + 장착 + 스탯 + 시작버튼 ==========

        this.add.text(leftCx, 30, 'SURVIVOR LOBBY', {
            fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5);

        this.add.text(leftCx, 60, `Points: ${state.points}`, {
            fontSize: '16px', color: '#ffcc00',
        }).setOrigin(0.5);

        // 캐릭터
        this.add.rectangle(leftCx, 140, 60, 60, 0x0000ff);
        this.add.text(leftCx, 180, 'PLAYER', {
            fontSize: '12px', color: '#88ccff',
        }).setOrigin(0.5);

        // 장착 슬롯 (캐릭터 아래)
        const slotY = 260;

        EQUIP_SLOTS.forEach((slot, i) => {
            const slotX = leftCx - 80 + i * 160;

            this.add.rectangle(slotX, slotY, 100, 100, 0x333355).setStrokeStyle(2, 0x6666aa);
            this.add.text(slotX, slotY - 60, slot.label, {
                fontSize: '13px', color: '#aaaacc',
            }).setOrigin(0.5);

            const equipped = state.equipped[slot.id as keyof typeof state.equipped];
            if (equipped) {
                const def = equipped.def;
                const circle = this.add.circle(slotX, slotY - 8, 30, def.color)
                    .setInteractive({ useHandCursor: true });
                this.add.text(slotX, slotY + 28, def.name, {
                    fontSize: '11px', color: '#ffffff',
                }).setOrigin(0.5);
                const bonus = def.atkBonus > 0 ? `ATK+${def.atkBonus}` : `HP+${def.hpBonus}`;
                this.add.text(slotX, slotY + 44, bonus, {
                    fontSize: '10px', color: '#88ff88',
                }).setOrigin(0.5);

                circle.on('pointerdown', () => {
                    useGameStore.getState().unequip(slot.id as 'weapon' | 'armor');
                    this.scene.restart();
                });
            } else {
                this.add.text(slotX, slotY, '비어있음', {
                    fontSize: '12px', color: '#666688',
                }).setOrigin(0.5);
            }
        });

        // 총 스탯
        const wepBonus = state.equipped.weapon?.def.atkBonus ?? 0;
        const armAtkBonus = state.equipped.armor?.def.atkBonus ?? 0;
        const wepHpBonus = state.equipped.weapon?.def.hpBonus ?? 0;
        const armHpBonus = state.equipped.armor?.def.hpBonus ?? 0;
        const totalAtk = PLAYER_ATK + wepBonus + armAtkBonus;
        const totalHp = PLAYER_HP + wepHpBonus + armHpBonus;

        this.add.text(leftCx, 340, `총 스탯:  ATK ${totalAtk}  /  HP ${totalHp}`, {
            fontSize: '14px', color: '#dddddd',
        }).setOrigin(0.5);

        // 시작 버튼
        const startBtn = this.add.rectangle(leftCx, VIEWPORT_HEIGHT - 70, 200, 50, 0x22aa44)
            .setInteractive({ useHandCursor: true });
        this.add.text(leftCx, VIEWPORT_HEIGHT - 70, '▶  게임 시작', {
            fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5);

        startBtn.on('pointerover', () => startBtn.setFillStyle(0x33cc55));
        startBtn.on('pointerout', () => startBtn.setFillStyle(0x22aa44));
        startBtn.on('pointerdown', () => this.scene.start('MainScene'));

        this.add.text(leftCx, VIEWPORT_HEIGHT - 30, '장착 슬롯 클릭: 해제', {
            fontSize: '10px', color: '#666688',
        }).setOrigin(0.5);

        // 인벤토리(상점) 이동 버튼
        const invBtn = this.add.rectangle(VIEWPORT_WIDTH - 120, VIEWPORT_HEIGHT - 70, 180, 50, 0x8A2BE2)
            .setInteractive({ useHandCursor: true });
        this.add.text(VIEWPORT_WIDTH - 120, VIEWPORT_HEIGHT - 70, '💎 인벤토리 (NFT)', {
            fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5);

        invBtn.on('pointerover', () => invBtn.setFillStyle(0x9B30FF));
        invBtn.on('pointerout', () => invBtn.setFillStyle(0x8A2BE2));
        invBtn.on('pointerdown', () => {
            window.location.href = '/inventory';
        });

        // ========== 오른쪽 50%: 인벤토리 그리드 + 선택 영역 ==========

        // in_game_item_id 기준 그룹화
        const groups = new Map<string, OwnedItem[]>();
        for (const item of state.inventory) {
            if (!groups.has(item.itemId)) groups.set(item.itemId, []);
            groups.get(item.itemId)!.push(item);
        }
        const invGroups = Array.from(groups.values());

        this.add.text(rightCx, 30, `인벤토리 (${invGroups.length}종 · ${state.inventory.length}개 / ${INVENTORY_MAX_SLOTS})`, {
            fontSize: '13px', color: '#aaaaaa',
        }).setOrigin(0.5);

        const cols = 5;
        const cellSize = 54;
        const gap = 6;
        const gridW = cols * cellSize + (cols - 1) * gap;
        const gridStartX = rightCx - gridW / 2 + cellSize / 2;
        const gridStartY = 75;

        for (let idx = 0; idx < INVENTORY_MAX_SLOTS; idx++) {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const x = gridStartX + col * (cellSize + gap);
            const y = gridStartY + row * (cellSize + gap);

            this.add.rectangle(x, y, cellSize, cellSize, 0x222244).setStrokeStyle(1, 0x444466);

            const group = invGroups[idx];
            if (!group) continue;

            const count = group.length;
            const groupHasEquipped = group.some(
                (it) => Object.values(state.equipped).some((eq) => eq?.uid === it.uid)
            );
            // 장착 중이 아닌 아이템을 대표로, 없으면 첫 번째
            const rep = group.find(
                (it) => !Object.values(state.equipped).some((eq) => eq?.uid === it.uid)
            ) ?? group[0];

            const color = RARITY_COLORS[rep.def.rarity];
            const circle = this.add.circle(x, y - 4, 19, color)
                .setInteractive({ useHandCursor: true });

            if (groupHasEquipped) {
                circle.setStrokeStyle(3, 0x00ff00);
            }

            this.add.text(x, y + 20, rep.def.name, {
                fontSize: '8px', color: '#cccccc',
            }).setOrigin(0.5);

            // 수량 뱃지 (2개 이상)
            if (count > 1) {
                this.add.text(x + 24, y - 24, `x${count}`, {
                    fontSize: '9px', color: '#ffff00', fontStyle: 'bold',
                }).setOrigin(1, 0);
            }

            circle.on('pointerdown', () => {
                this.selectItem(rep, circle, count, groupHasEquipped);
            });
        }

        // 선택 영역 배경 (빈 상태 안내)
        const selY = gridStartY + Math.ceil(INVENTORY_MAX_SLOTS / cols) * (cellSize + gap) + 20;
        this.add.rectangle(rightCx, selY + 30, gridW + 20, 100, 0x1a1a2e)
            .setStrokeStyle(1, 0x333366);
        this.add.text(rightCx, selY + 30, '아이템을 선택하세요', {
            fontSize: '13px', color: '#555577',
        }).setOrigin(0.5).setName('selectionPlaceholder');
    }

    private selectItem(item: OwnedItem, circle: Phaser.GameObjects.Arc, count: number = 1, groupHasEquipped: boolean = false): void {
        // 같은 그룹 다시 클릭 → 선택 해제
        if (this.selectedItem?.itemId === item.itemId) {
            this.clearSelection();
            return;
        }

        this.clearSelection();
        this.selectedItem = item;

        // 원래 테두리 저장 후 노란 하이라이트 적용
        this.selectedHighlight = circle;
        this.selectedHighlightOriginalStroke = groupHasEquipped
            ? { width: 3, color: 0x00ff00 }
            : { width: 0, color: 0x000000 };
        circle.setStrokeStyle(3, 0xffff00);

        const rightCx = VIEWPORT_WIDTH / 2 + VIEWPORT_WIDTH / 4;
        const cols = 5;
        const cellSize = 54;
        const gap = 6;
        const gridStartY = 75;
        const selY = gridStartY + Math.ceil(INVENTORY_MAX_SLOTS / cols) * (cellSize + gap) + 20;

        // placeholder 숨기기
        const placeholder = this.children.getByName('selectionPlaceholder');
        if (placeholder) (placeholder as Phaser.GameObjects.Text).setVisible(false);

        const bonus = item.def.atkBonus > 0
            ? `ATK+${item.def.atkBonus}`
            : `HP+${item.def.hpBonus}`;
        const rarityLabel = { common: 'Common', rare: 'Rare', epic: 'Epic' }[item.def.rarity];
        const countLabel = count > 1 ? `  x${count}` : '';
        const infoText = this.add.text(rightCx, selY + 8,
            `${item.def.name}  (${rarityLabel})${countLabel}  ${bonus}`, {
            fontSize: '14px', color: '#ffffff',
        }).setOrigin(0.5);
        this.selectionUI.push(infoText);

        if (groupHasEquipped) {
            const unequipBtn = this.createButton(
                rightCx, selY + 45, 140, 36, 0x886622, '해제',
                () => {
                    const slotId = item.def.type as 'weapon' | 'armor';
                    useGameStore.getState().unequip(slotId);
                    this.scene.restart();
                }
            );
            this.selectionUI.push(...unequipBtn);
        } else {
            const equipBtn = this.createButton(
                rightCx - 80, selY + 45, 130, 36, 0x2266cc, '장착',
                () => {
                    const slotId = item.def.type as 'weapon' | 'armor';
                    useGameStore.getState().equip(slotId, item);
                    this.scene.restart();
                }
            );
            this.selectionUI.push(...equipBtn);

            const burnBtn = this.createButton(
                rightCx + 80, selY + 45, 130, 36, 0xcc3333, '소각 (+10pt)',
                () => {
                    useGameStore.getState().burnItem(item.uid);
                    this.scene.restart();
                }
            );
            this.selectionUI.push(...burnBtn);
        }
    }

    private clearSelection(): void {
        this.selectedItem = null;
        if (this.selectedHighlight) {
            if (this.selectedHighlightOriginalStroke && this.selectedHighlightOriginalStroke.width > 0) {
                this.selectedHighlight.setStrokeStyle(
                    this.selectedHighlightOriginalStroke.width,
                    this.selectedHighlightOriginalStroke.color
                );
            } else {
                this.selectedHighlight.setStrokeStyle(0);
            }
            this.selectedHighlight = null;
            this.selectedHighlightOriginalStroke = null;
        }
        this.selectionUI.forEach((obj) => obj.destroy());
        this.selectionUI = [];

        const placeholder = this.children.getByName('selectionPlaceholder');
        if (placeholder) (placeholder as Phaser.GameObjects.Text).setVisible(true);
    }

    private createButton(
        x: number, y: number, w: number, h: number,
        color: number, label: string, onClick: () => void
    ): Phaser.GameObjects.GameObject[] {
        const hoverColor = Phaser.Display.Color.ValueToColor(color).lighten(20).color;

        const btn = this.add.rectangle(x, y, w, h, color)
            .setInteractive({ useHandCursor: true });
        const txt = this.add.text(x, y, label, {
            fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5);

        btn.on('pointerover', () => btn.setFillStyle(hoverColor));
        btn.on('pointerout', () => btn.setFillStyle(color));
        btn.on('pointerdown', onClick);

        return [btn, txt];
    }
}
