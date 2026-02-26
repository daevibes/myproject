import * as Phaser from 'phaser';
import { Monster } from './Monster';
import {
    INFANTRY_HP,
    INFANTRY_SPEED,
    INFANTRY_ATK,
    INFANTRY_SIZE,
    INFANTRY_COLOR,
} from '../config/constants';

export class Infantry extends Monster {
    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, INFANTRY_SIZE, INFANTRY_COLOR, INFANTRY_HP, INFANTRY_ATK, INFANTRY_SPEED);
    }

    updateAI(
        princess: Phaser.GameObjects.Rectangle,
        _player: Phaser.GameObjects.Rectangle
    ): void {
        if (this.isDead) return;
        // 공주 방향으로 직선 이동 (플레이어 무시)
        this.scene.physics.moveToObject(this, princess, this.moveSpeed);
    }
}
