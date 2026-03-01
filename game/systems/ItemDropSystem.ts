import * as Phaser from 'phaser';
import { ItemDrop } from '../entities/ItemDrop';
import { Player } from '../entities/Player';
import { ITEM_DEFS } from '../config/items';
import { rollDrop } from '../config/dropTable';
import { ITEM_PICKUP_RANGE, ITEM_POPUP_DURATION } from '../config/constants';
import { useGameStore, OwnedItem } from '@/lib/store/useGameStore';

export class ItemDropSystem {
    private scene: Phaser.Scene;
    private drops: ItemDrop[] = [];

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    tryDrop(x: number, y: number): void {
        const itemId = rollDrop();
        if (!itemId) return;

        const def = ITEM_DEFS[itemId];
        if (!def) return;

        const offsetX = (Math.random() - 0.5) * 40;
        const offsetY = (Math.random() - 0.5) * 40;
        const drop = new ItemDrop(this.scene, x + offsetX, y + offsetY, def);
        this.drops.push(drop);
    }

    update(player: Player): void {
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const drop = this.drops[i];
            if (!drop.active) {
                this.drops.splice(i, 1);
                continue;
            }

            const dist = Phaser.Math.Distance.Between(player.x, player.y, drop.x, drop.y);
            if (dist <= ITEM_PICKUP_RANGE) {
                this.pickUp(drop, i);
            }
        }
    }

    private pickUp(drop: ItemDrop, index: number): void {
        const store = useGameStore.getState();

        if (!store.canPickUp()) {
            this.showPopup(drop.x, drop.y - 20, '인벤토리 가득!', '#ff4444');
            this.drops.splice(index, 1);
            drop.destroy();
            return;
        }

        const owned: OwnedItem = {
            uid: drop.uid,
            itemId: drop.itemDef.id,
            def: drop.itemDef,
        };

        // 인게임 임시 보관 (DB 저장은 게임 종료 시 일괄 처리)
        store.addPendingItem(owned);

        const rarityLabel = drop.itemDef.rarity === 'epic' ? '★' : drop.itemDef.rarity === 'rare' ? '◆' : '';
        this.showPopup(drop.x, drop.y - 20, `${rarityLabel} ${drop.itemDef.name} 획득!`, '#ffff44');

        this.drops.splice(index, 1);
        drop.destroy();
    }

    private showPopup(x: number, y: number, msg: string, color: string): void {
        const text = this.scene.add
            .text(x, y, msg, { fontSize: '14px', color, fontStyle: 'bold' })
            .setOrigin(0.5)
            .setDepth(1000);

        this.scene.tweens.add({
            targets: text,
            y: y - 30,
            alpha: 0,
            duration: ITEM_POPUP_DURATION,
            onComplete: () => text.destroy(),
        });
    }

    getDrops(): ItemDrop[] {
        return this.drops;
    }
}
