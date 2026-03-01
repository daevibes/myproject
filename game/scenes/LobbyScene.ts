import * as Phaser from 'phaser';
import { useGameStore, OwnedItem } from '@/lib/store/useGameStore';
import { EQUIP_SLOTS, EquipSlotId, RARITY_COLORS } from '../config/items';
import {
    VIEWPORT_WIDTH,
    VIEWPORT_HEIGHT,
    INVENTORY_MAX_SLOTS,
    PLAYER_HP,
    PLAYER_ATK,
    PLAYER_SPEED,
    BURN_POINT_REWARD,
} from '../config/constants';

export class LobbyScene extends Phaser.Scene {
    private selectedItem: OwnedItem | null = null;
    private selectionUI: Phaser.GameObjects.GameObject[] = [];
    private selectedHighlight: Phaser.GameObjects.Arc | null = null;
    private selectedHighlightOriginalStroke: { width: number; color: number } | null = null;

    // 슬롯 선택 모드
    private activeSlot: EquipSlotId | null = null;
    private slotHighlights: Phaser.GameObjects.Rectangle[] = [];
    private inventoryCircles: { circle: Phaser.GameObjects.Arc; item: OwnedItem; groupHasEquipped: boolean }[] = [];
    private unequipUI: Phaser.GameObjects.GameObject[] = [];

    // 소각 수량 선택
    private burnQtyUI: Phaser.GameObjects.GameObject[] = [];
    private burnQty: number = 1;

    constructor() {
        super('LobbyScene');
    }

    create() {
        this.selectedItem = null;
        this.selectionUI = [];
        this.selectedHighlight = null;
        this.selectedHighlightOriginalStroke = null;
        this.activeSlot = null;
        this.slotHighlights = [];
        this.inventoryCircles = [];
        this.unequipUI = [];
        this.burnQtyUI = [];
        this.burnQty = 1;

        this.cameras.main.setBackgroundColor(0x1a1a2e);

        const halfW = VIEWPORT_WIDTH / 2;
        const leftCx = halfW / 2;
        const rightCx = halfW + halfW / 2;

        this.add.rectangle(halfW, VIEWPORT_HEIGHT / 2, 2, VIEWPORT_HEIGHT - 40, 0x333366);

        const state = useGameStore.getState();

        // ══════════ 왼쪽 50%: 타이틀 + 캐릭터 + 6슬롯 장착 + 스탯 + 시작 ══════════

        this.add.text(leftCx, 30, 'SURVIVOR LOBBY', {
            fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5);

        this.add.text(leftCx, 58, `Points: ${state.points}`, {
            fontSize: '15px', color: '#ffcc00',
        }).setOrigin(0.5);

        // 캐릭터 표시
        this.add.rectangle(leftCx, 110, 50, 50, 0x0000ff);
        this.add.text(leftCx, 142, 'PLAYER', { fontSize: '11px', color: '#88ccff' }).setOrigin(0.5);

        // ── 6슬롯 레이아웃 (2행 × 3열) ──
        const slotW = 72, slotH = 64, slotGapX = 10, slotGapY = 8;
        const slotRows = 2, slotCols = 3;
        const gridW = slotCols * slotW + (slotCols - 1) * slotGapX;
        const gridStartX = leftCx - gridW / 2 + slotW / 2;
        const gridStartY = 185;

        const slotOrder: EquipSlotId[] = ['Head', 'Body', 'Legs', 'Shoes', 'RightHand', 'LeftHand'];

        slotOrder.forEach((slotId, idx) => {
            const col = idx % slotCols;
            const row = Math.floor(idx / slotCols);
            const sx = gridStartX + col * (slotW + slotGapX);
            const sy = gridStartY + row * (slotH + slotGapY);

            const slotDef = EQUIP_SLOTS.find((s) => s.id === slotId)!;
            const equipped = state.equipped[slotId];

            // 슬롯 배경 — interactive로 변경
            const slotBg = this.add.rectangle(sx, sy, slotW, slotH, 0x222244)
                .setStrokeStyle(2, 0x6666aa)
                .setInteractive({ useHandCursor: true });
            this.slotHighlights.push(slotBg);

            this.add.text(sx, sy - slotH / 2 - 10, slotDef.label, {
                fontSize: '10px', color: '#aaaacc',
            }).setOrigin(0.5);

            // 슬롯 클릭 → 슬롯 선택 모드
            slotBg.on('pointerdown', () => {
                this.onSlotClick(slotId, slotBg);
            });

            if (equipped) {
                // 양손 무기 LeftHand 점유 표시
                const isProxied = equipped.def.isTwoHanded && slotId === 'LeftHand';
                if (isProxied) {
                    this.add.text(sx, sy, '[양손 점유]', {
                        fontSize: '9px', color: '#aaffaa', align: 'center',
                    }).setOrigin(0.5);
                } else {
                    this.add.circle(sx, sy - 8, 22, equipped.def.color);
                    this.add.text(sx, sy + 20, equipped.def.name, {
                        fontSize: '8px', color: '#ffffff',
                    }).setOrigin(0.5);

                    // 스탯 요약
                    const bonusParts: string[] = [];
                    if (equipped.def.atkBonus   > 0) bonusParts.push(`ATK+${equipped.def.atkBonus}`);
                    if (equipped.def.defBonus   > 0) bonusParts.push(`DEF+${equipped.def.defBonus}`);
                    if (equipped.def.hpBonus    > 0) bonusParts.push(`HP+${equipped.def.hpBonus}`);
                    if (equipped.def.speedBonus > 0) bonusParts.push(`SPD+${equipped.def.speedBonus}`);
                    this.add.text(sx, sy + 32, bonusParts.join(' '), {
                        fontSize: '7px', color: '#88ff88',
                    }).setOrigin(0.5);
                }
            } else {
                this.add.text(sx, sy, '비어있음', { fontSize: '10px', color: '#666688' }).setOrigin(0.5);
            }
        });

        // ── 총 스탯 ──
        let totalAtk = PLAYER_ATK, totalDef = 0, totalHp = PLAYER_HP, totalSpd = PLAYER_SPEED;
        const seenUids = new Set<string>();
        for (const item of Object.values(state.equipped)) {
            if (!item || seenUids.has(item.uid)) continue;
            seenUids.add(item.uid);
            totalAtk += item.def.atkBonus;
            totalDef += item.def.defBonus;
            totalHp  += item.def.hpBonus;
            totalSpd += item.def.speedBonus;
        }

        const statsY = gridStartY + slotRows * (slotH + slotGapY) + 18;
        this.add.text(leftCx, statsY, `ATK ${totalAtk}  DEF ${totalDef}  HP ${totalHp}  SPD ${totalSpd}`, {
            fontSize: '12px', color: '#dddddd',
        }).setOrigin(0.5);

        // ── 시작 버튼 ──
        const startBtn = this.add.rectangle(leftCx, VIEWPORT_HEIGHT - 70, 200, 50, 0x22aa44)
            .setInteractive({ useHandCursor: true });
        this.add.text(leftCx, VIEWPORT_HEIGHT - 70, '▶  게임 시작', {
            fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5);
        startBtn.on('pointerover', () => startBtn.setFillStyle(0x33cc55));
        startBtn.on('pointerout',  () => startBtn.setFillStyle(0x22aa44));
        startBtn.on('pointerdown', () => this.scene.start('MainScene'));

        this.add.text(leftCx, VIEWPORT_HEIGHT - 30, '슬롯 클릭 → 장착할 아이템 선택', {
            fontSize: '10px', color: '#666688',
        }).setOrigin(0.5);

        // 인벤토리(NFT) 이동 버튼
        const invBtn = this.add.rectangle(VIEWPORT_WIDTH - 120, VIEWPORT_HEIGHT - 70, 180, 50, 0x8A2BE2)
            .setInteractive({ useHandCursor: true });
        this.add.text(VIEWPORT_WIDTH - 120, VIEWPORT_HEIGHT - 70, '💎 인벤토리 (NFT)', {
            fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5);
        invBtn.on('pointerover', () => invBtn.setFillStyle(0x9B30FF));
        invBtn.on('pointerout',  () => invBtn.setFillStyle(0x8A2BE2));
        invBtn.on('pointerdown', () => { window.location.href = '/inventory'; });

        // ══════════ 오른쪽 50%: 인벤토리 그리드 ══════════

        const groups = new Map<string, OwnedItem[]>();
        for (const item of state.inventory) {
            if (!groups.has(item.itemId)) groups.set(item.itemId, []);
            groups.get(item.itemId)!.push(item);
        }
        const invGroups = Array.from(groups.values());

        this.add.text(rightCx, 30, `인벤토리 (${invGroups.length}종 · ${state.inventory.length}개 / ${INVENTORY_MAX_SLOTS})`, {
            fontSize: '12px', color: '#aaaaaa',
        }).setOrigin(0.5);

        const cols = 5;
        const cellSize = 54;
        const gap = 6;
        const gridW2 = cols * cellSize + (cols - 1) * gap;
        const gridStartX2 = rightCx - gridW2 / 2 + cellSize / 2;
        const gridStartY2 = 70;

        for (let idx = 0; idx < INVENTORY_MAX_SLOTS; idx++) {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const x = gridStartX2 + col * (cellSize + gap);
            const y = gridStartY2 + row * (cellSize + gap);

            this.add.rectangle(x, y, cellSize, cellSize, 0x222244).setStrokeStyle(1, 0x444466);

            const group = invGroups[idx];
            if (!group) continue;

            const count = group.length;
            const groupHasEquipped = group.some(
                (it) => Object.values(state.equipped).some((eq) => eq?.uid === it.uid)
            );
            const rep = group.find(
                (it) => !Object.values(state.equipped).some((eq) => eq?.uid === it.uid)
            ) ?? group[0];

            const color = RARITY_COLORS[rep.def.rarity];
            const circle = this.add.circle(x, y - 4, 19, color)
                .setInteractive({ useHandCursor: true });

            if (groupHasEquipped) circle.setStrokeStyle(3, 0x00ff00);

            this.add.text(x, y + 20, rep.def.name, {
                fontSize: '7px', color: '#cccccc',
            }).setOrigin(0.5);

            if (count > 1) {
                this.add.text(x + 24, y - 24, `x${count}`, {
                    fontSize: '9px', color: '#ffff00', fontStyle: 'bold',
                }).setOrigin(1, 0);
            }

            // 인벤토리 아이템 참조 저장
            this.inventoryCircles.push({ circle, item: rep, groupHasEquipped });

            circle.on('pointerdown', () => {
                if (this.activeSlot) {
                    // 슬롯 선택 모드 — 호환 아이템이면 장착
                    if (this.isCompatible(rep, this.activeSlot)) {
                        useGameStore.getState().equip(this.activeSlot, rep);
                        this.scene.restart();
                    }
                    return;
                }
                // 일반 모드 — 아이템 정보 표시
                this.selectItem(rep, circle, count, groupHasEquipped, group);
            });
        }

        // 선택 패널
        const selY = gridStartY2 + Math.ceil(INVENTORY_MAX_SLOTS / cols) * (cellSize + gap) + 18;
        this.add.rectangle(rightCx, selY + 30, gridW2 + 20, 100, 0x1a1a2e)
            .setStrokeStyle(1, 0x333366);
        this.add.text(rightCx, selY + 30, '아이템을 선택하세요', {
            fontSize: '13px', color: '#555577',
        }).setOrigin(0.5).setName('selectionPlaceholder');
    }

    /** 슬롯 클릭 시: 슬롯 선택 모드 진입/해제 */
    private onSlotClick(slotId: EquipSlotId, slotBg: Phaser.GameObjects.Rectangle): void {
        const state = useGameStore.getState();

        // 같은 슬롯 재클릭 → 선택 해제
        if (this.activeSlot === slotId) {
            this.clearSlotMode();
            return;
        }

        // 슬롯 선택 모드 진입
        this.clearSlotMode();
        this.clearSelection();
        this.activeSlot = slotId;

        // 선택된 슬롯 하이라이트
        slotBg.setStrokeStyle(3, 0xffff00);

        // 인벤토리 아이템 호환 여부 표시
        for (const entry of this.inventoryCircles) {
            if (this.isCompatible(entry.item, slotId)) {
                entry.circle.setStrokeStyle(3, 0xffff00);
            } else {
                entry.circle.setAlpha(0.3);
            }
        }

        // 장착된 아이템이 있으면 장착 해제 버튼 표시
        const equipped = state.equipped[slotId];
        const isProxied = equipped?.def.isTwoHanded && slotId === 'LeftHand';
        if (equipped && !isProxied) {
            const placeholder = this.children.getByName('selectionPlaceholder');
            if (placeholder) (placeholder as Phaser.GameObjects.Text).setVisible(false);

            const rightCx = VIEWPORT_WIDTH / 2 + VIEWPORT_WIDTH / 4;
            const cols = 5, cellSize = 54, gap = 6, gridStartY2 = 70;
            const selY = gridStartY2 + Math.ceil(INVENTORY_MAX_SLOTS / cols) * (cellSize + gap) + 18;

            const slotLabel = EQUIP_SLOTS.find((s) => s.id === slotId)?.label ?? slotId;
            const info = this.add.text(rightCx, selY + 12, `[${slotLabel}] ${equipped.def.name} 장착 중`, {
                fontSize: '12px', color: '#ffffff',
            }).setOrigin(0.5);
            this.unequipUI.push(info);

            const [btn, lbl] = this.createButton(rightCx, selY + 48, 140, 36, 0x886622, '장착 해제', () => {
                useGameStore.getState().unequip(slotId);
                this.scene.restart();
            });
            this.unequipUI.push(btn, lbl);
        }
    }

    /** 호환성 체크: 아이템이 해당 슬롯에 장착 가능한지 */
    private isCompatible(item: OwnedItem, slotId: EquipSlotId): boolean {
        return item.def.slot === slotId ||
            (slotId === 'LeftHand' && item.def.weaponType === 'Sword');
    }

    /** 슬롯 선택 모드 해제 */
    private clearSlotMode(): void {
        this.activeSlot = null;

        // 슬롯 하이라이트 복원
        for (const slotBg of this.slotHighlights) {
            slotBg.setStrokeStyle(2, 0x6666aa);
        }

        // 인벤토리 아이템 외형 복원
        for (const entry of this.inventoryCircles) {
            entry.circle.setAlpha(1);
            if (entry.groupHasEquipped) {
                entry.circle.setStrokeStyle(3, 0x00ff00);
            } else {
                entry.circle.setStrokeStyle(0);
            }
        }

        // 장착 해제 UI 제거
        this.unequipUI.forEach((obj) => obj.destroy());
        this.unequipUI = [];

        const placeholder = this.children.getByName('selectionPlaceholder');
        if (placeholder) (placeholder as Phaser.GameObjects.Text).setVisible(true);
    }

    private selectItem(
        item: OwnedItem, circle: Phaser.GameObjects.Arc,
        count: number = 1, groupHasEquipped: boolean = false,
        group: OwnedItem[] = []
    ): void {
        if (this.selectedItem?.itemId === item.itemId) {
            this.clearSelection();
            return;
        }

        this.clearSelection();
        this.selectedItem = item;
        this.selectedHighlight = circle;
        this.selectedHighlightOriginalStroke = groupHasEquipped
            ? { width: 3, color: 0x00ff00 }
            : { width: 0, color: 0x000000 };
        circle.setStrokeStyle(3, 0xffff00);

        const rightCx = VIEWPORT_WIDTH / 2 + VIEWPORT_WIDTH / 4;
        const cols = 5, cellSize = 54, gap = 6, gridStartY2 = 70;
        const selY = gridStartY2 + Math.ceil(INVENTORY_MAX_SLOTS / cols) * (cellSize + gap) + 18;

        const placeholder = this.children.getByName('selectionPlaceholder');
        if (placeholder) (placeholder as Phaser.GameObjects.Text).setVisible(false);

        // 스탯 요약 문자열
        const parts: string[] = [];
        if (item.def.atkBonus   > 0) parts.push(`ATK+${item.def.atkBonus}`);
        if (item.def.defBonus   > 0) parts.push(`DEF+${item.def.defBonus}`);
        if (item.def.hpBonus    > 0) parts.push(`HP+${item.def.hpBonus}`);
        if (item.def.speedBonus > 0) parts.push(`SPD+${item.def.speedBonus}`);

        const rarityLabel = { common: 'Common', rare: 'Rare', epic: 'Epic' }[item.def.rarity];
        const slotLabel = EQUIP_SLOTS.find((s) => s.id === item.def.slot)?.label ?? item.def.slot;
        const countLabel = count > 1 ? `  x${count}` : '';
        const infoText = this.add.text(
            rightCx, selY + 8,
            `${item.def.name}  (${rarityLabel})${countLabel}  [${slotLabel}]  ${parts.join(' ')}`,
            { fontSize: '12px', color: '#ffffff' }
        ).setOrigin(0.5);
        this.selectionUI.push(infoText);

        if (groupHasEquipped) {
            const [btn, lbl] = this.createButton(rightCx, selY + 48, 140, 36, 0x886622, '장착 해제', () => {
                useGameStore.getState().unequip(item.def.slot);
                this.scene.restart();
            });
            this.selectionUI.push(btn, lbl);
        } else {
            const [btn1, lbl1] = this.createButton(rightCx - 80, selY + 48, 130, 36, 0x2266cc, '장착', () => {
                useGameStore.getState().equip(item.def.slot, item);
                this.scene.restart();
            });
            this.selectionUI.push(btn1, lbl1);

            // 비장착 uid 목록 (소각 대상)
            const state = useGameStore.getState();
            const unequippedUids = group
                .filter((it) => !Object.values(state.equipped).some((eq) => eq?.uid === it.uid))
                .map((it) => it.uid);
            const burnableCount = unequippedUids.length;

            if (burnableCount >= 2) {
                // 수량 선택 소각 UI
                this.burnQty = 1;
                this.showBurnQtyUI(rightCx, selY + 48, burnableCount, unequippedUids);
            } else {
                // 1개: 즉시 소각
                const [btn2, lbl2] = this.createButton(rightCx + 80, selY + 48, 130, 36, 0xcc3333, `소각 (+${BURN_POINT_REWARD}pt)`, () => {
                    useGameStore.getState().burnItem(item.uid);
                    this.scene.restart();
                });
                this.selectionUI.push(btn2, lbl2);
            }
        }
    }

    private showBurnQtyUI(cx: number, baseY: number, max: number, uids: string[]): void {
        this.clearBurnQtyUI();

        const minusX = cx + 30;
        const qtyX = cx + 62;
        const plusX = cx + 94;
        const confirmX = cx + 62;

        // "-" 버튼
        const [minusBtn, minusLbl] = this.createButton(minusX, baseY, 28, 28, 0x555577, '-', () => {
            if (this.burnQty > 1) {
                this.burnQty--;
                this.updateBurnQtyDisplay(qtyLbl, confirmLbl, max);
            }
        });
        this.burnQtyUI.push(minusBtn, minusLbl);
        this.selectionUI.push(minusBtn, minusLbl);

        // 수량 표시
        const qtyLbl = this.add.text(qtyX, baseY, `${this.burnQty}`, {
            fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.burnQtyUI.push(qtyLbl);
        this.selectionUI.push(qtyLbl);

        // "+" 버튼
        const [plusBtn, plusLbl] = this.createButton(plusX, baseY, 28, 28, 0x555577, '+', () => {
            if (this.burnQty < max) {
                this.burnQty++;
                this.updateBurnQtyDisplay(qtyLbl, confirmLbl, max);
            }
        });
        this.burnQtyUI.push(plusBtn, plusLbl);
        this.selectionUI.push(plusBtn, plusLbl);

        // 확인 소각 버튼
        const confirmLabel = `소각 (${this.burnQty}개, +${this.burnQty * BURN_POINT_REWARD}pt)`;
        const [confirmBtn, confirmLbl] = this.createButton(confirmX, baseY + 34, 160, 32, 0xcc3333, confirmLabel, () => {
            const selected = uids.slice(0, this.burnQty);
            useGameStore.getState().burnItems(selected);
            this.scene.restart();
        });
        this.burnQtyUI.push(confirmBtn, confirmLbl);
        this.selectionUI.push(confirmBtn, confirmLbl);
    }

    private updateBurnQtyDisplay(
        qtyLbl: Phaser.GameObjects.Text,
        confirmLbl: Phaser.GameObjects.Text,
        _max: number
    ): void {
        qtyLbl.setText(`${this.burnQty}`);
        confirmLbl.setText(`소각 (${this.burnQty}개, +${this.burnQty * BURN_POINT_REWARD}pt)`);
    }

    private clearBurnQtyUI(): void {
        this.burnQtyUI.forEach((obj) => obj.destroy());
        this.burnQtyUI = [];
    }

    private clearSelection(): void {
        this.selectedItem = null;
        if (this.selectedHighlight) {
            if (this.selectedHighlightOriginalStroke?.width) {
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
    ): [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Text] {
        const hoverColor = Phaser.Display.Color.ValueToColor(color).lighten(20).color;
        const btn = this.add.rectangle(x, y, w, h, color).setInteractive({ useHandCursor: true });
        const txt = this.add.text(x, y, label, {
            fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5);
        btn.on('pointerover', () => btn.setFillStyle(hoverColor));
        btn.on('pointerout',  () => btn.setFillStyle(color));
        btn.on('pointerdown', onClick);
        return [btn, txt];
    }
}
