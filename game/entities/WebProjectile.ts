import * as Phaser from 'phaser';
import { Player } from './Player';

const WEB_SPEED = 180;
const WEB_RADIUS = 10;
const WEB_SLOW_DURATION = 3000; // ms
const WEB_SLOW_AMOUNT = 0.5;    // 이속 50% 감소
const WEB_LIFETIME = 4000;      // ms

export class WebProjectile extends Phaser.GameObjects.Arc {
    declare body: Phaser.Physics.Arcade.Body;

    private velocityX: number;
    private velocityY: number;
    private expired: boolean = false;

    constructor(scene: Phaser.Scene, x: number, y: number, targetX: number, targetY: number) {
        super(scene, x, y, WEB_RADIUS, 0, 360, false, 0x226622, 1);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setDepth(50);

        const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);
        this.velocityX = Math.cos(angle) * WEB_SPEED;
        this.velocityY = Math.sin(angle) * WEB_SPEED;

        this.body.setCircle(WEB_RADIUS);
        this.body.setVelocity(this.velocityX, this.velocityY);
        this.body.setAllowGravity(false);

        // 수명 후 소멸
        scene.time.delayedCall(WEB_LIFETIME, () => {
            if (this.active) this.expire();
        });
    }

    update(player: Player): void {
        if (this.expired || !this.active) return;

        // 플레이어 충돌 체크
        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (dist < WEB_RADIUS + 16) {
            this.hitPlayer(player);
        }
    }

    private hitPlayer(player: Player): void {
        this.expire();
        // 이속 감소 디버프
        player.slowMultiplier = WEB_SLOW_AMOUNT;
        this.scene.time.delayedCall(WEB_SLOW_DURATION, () => {
            if (player.active) player.slowMultiplier = 1.0;
        });

        // 거미줄 히트 이펙트
        const flash = this.scene.add.circle(player.x, player.y, 20, 0x226622, 0.6).setDepth(100);
        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 300,
            onComplete: () => flash.destroy(),
        });
    }

    expire(): void {
        this.expired = true;
        if (this.body) this.body.setVelocity(0);
        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            duration: 150,
            onComplete: () => { if (this.active) this.destroy(); },
        });
    }

    isExpired(): boolean {
        return this.expired || !this.active;
    }
}
