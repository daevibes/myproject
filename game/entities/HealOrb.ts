import * as Phaser from 'phaser';
import { Player } from './Player';
import { HEAL_ORB_SIZE, HEAL_ORB_DURATION, HEAL_ORB_HEAL_RATIO } from '../config/constants';

const PICKUP_RANGE = 30; // px

export class HealOrb extends Phaser.GameObjects.Arc {
    private expired: boolean = false;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, HEAL_ORB_SIZE / 2, 0, 360, false, 0x44ff44, 0.85);
        scene.add.existing(this);
        this.setDepth(15);
        this.setStrokeStyle(1.5, 0x88ffaa, 0.9);

        // 깜빡임 애니메이션
        scene.tweens.add({
            targets: this,
            alpha: { from: 0.85, to: 0.4 },
            duration: 500,
            yoyo: true,
            repeat: -1,
        });

        // 지속시간 후 소멸
        scene.time.delayedCall(HEAL_ORB_DURATION, () => {
            this.expire();
        });
    }

    tryPickup(player: Player): boolean {
        if (this.expired || !this.active) return false;

        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (dist > PICKUP_RANGE) return false;

        // HP 회복
        const healAmount = Math.ceil(player.maxHp * HEAL_ORB_HEAL_RATIO);
        player.hp = Math.min(player.maxHp, player.hp + healAmount);

        this.expired = true;
        this.scene.tweens.killTweensOf(this);
        if (this.active) this.destroy();
        return true;
    }

    private expire(): void {
        if (this.expired) return;
        this.expired = true;
        this.scene.tweens.killTweensOf(this);
        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            duration: 300,
            onComplete: () => { if (this.active) this.destroy(); },
        });
    }

    isExpired(): boolean {
        return this.expired || !this.active;
    }
}
