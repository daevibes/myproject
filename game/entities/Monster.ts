import * as Phaser from 'phaser';
import { MONSTER_FLASH_DURATION } from '../config/constants';

export abstract class Monster extends Phaser.GameObjects.Rectangle {
    declare body: Phaser.Physics.Arcade.Body;

    public hp: number;
    public maxHp: number;
    public atk: number;
    public moveSpeed: number;
    public isDead: boolean;

    protected originalColor: number;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        size: number,
        color: number,
        hp: number,
        atk: number,
        speed: number
    ) {
        super(scene, x, y, size, size, color);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.hp = hp;
        this.maxHp = hp;
        this.atk = atk;
        this.moveSpeed = speed;
        this.isDead = false;
        this.originalColor = color;
    }

    takeDamage(amount: number): void {
        if (this.isDead) return;
        this.hp -= amount;

        // 흰색 플래시
        this.setFillStyle(0xffffff);
        this.scene.time.delayedCall(MONSTER_FLASH_DURATION, () => {
            if (!this.isDead) {
                this.setFillStyle(this.originalColor);
            }
        });

        if (this.hp <= 0) {
            this.die();
        }
    }

    die(): void {
        this.isDead = true;
        this.body.setVelocity(0);
        this.body.enable = false;

        // 페이드아웃 후 제거
        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                this.destroy();
            },
        });
    }

    abstract updateAI(
        princess: Phaser.GameObjects.Rectangle,
        player: Phaser.GameObjects.Rectangle
    ): void;
}
