import * as Phaser from 'phaser';
import { Player } from './Player';

const FIRE_ZONE_SIZE = 80;
const FIRE_ZONE_DAMAGE = 8;
const FIRE_ZONE_TICK = 700;      // ms 간격으로 데미지
const FIRE_ZONE_DURATION = 5000; // ms 지속시간

export class FireZone extends Phaser.GameObjects.Rectangle {
    private expired: boolean = false;
    private lastDamageTime: number = -Infinity;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, FIRE_ZONE_SIZE, FIRE_ZONE_SIZE, 0xff4400, 0.55);
        scene.add.existing(this);
        this.setDepth(10);
        this.setStrokeStyle(2, 0xff8800, 0.8);

        // 깜빡임 애니메이션
        scene.tweens.add({
            targets: this,
            alpha: { from: 0.55, to: 0.3 },
            duration: 350,
            yoyo: true,
            repeat: -1,
        });

        // 지속시간 후 소멸
        scene.time.delayedCall(FIRE_ZONE_DURATION, () => {
            this.expire();
        });
    }

    update(player: Player, time: number): void {
        if (this.expired || !this.active) return;

        // 플레이어가 화염 위에 있는지 체크
        const halfSize = FIRE_ZONE_SIZE / 2;
        const inZone =
            player.x >= this.x - halfSize &&
            player.x <= this.x + halfSize &&
            player.y >= this.y - halfSize &&
            player.y <= this.y + halfSize;

        if (inZone && !player.isInvincible && (time - this.lastDamageTime) >= FIRE_ZONE_TICK) {
            player.takeDamage(FIRE_ZONE_DAMAGE);
            this.lastDamageTime = time;
        }
    }

    expire(): void {
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
