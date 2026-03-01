import * as Phaser from 'phaser';
import { ItemDef, RARITY_COLORS } from '../config/items';
import { ITEM_DROP_SIZE } from '../config/constants';

export class ItemDrop extends Phaser.GameObjects.Rectangle {
    declare body: Phaser.Physics.Arcade.Body;
    public itemDef: ItemDef;
    public uid: string;

    constructor(scene: Phaser.Scene, x: number, y: number, itemDef: ItemDef) {
        const color = RARITY_COLORS[itemDef.rarity];
        super(scene, x, y, ITEM_DROP_SIZE, ITEM_DROP_SIZE, color);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.body.setImmovable(true);
        this.body.setAllowGravity(false);

        this.itemDef = itemDef;
        this.uid = `${itemDef.id}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

        scene.tweens.add({
            targets: this,
            scaleX: 1.3,
            scaleY: 1.3,
            yoyo: true,
            repeat: -1,
            duration: 400,
            ease: 'Sine.easeInOut',
        });
    }
}
