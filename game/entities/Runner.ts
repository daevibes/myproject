import * as Phaser from 'phaser';
import { Monster } from './Monster';
import {
    RUNNER_HP,
    RUNNER_SPEED,
    RUNNER_ATK,
    RUNNER_SIZE,
    RUNNER_COLOR,
    RUNNER_DETECT_RANGE,
    RUNNER_RELEASE_RANGE,
} from '../config/constants';

type RunnerState = 'MOVE_TO_PRINCESS' | 'CHASE_PLAYER';

export class Runner extends Monster {
    private aiState: RunnerState;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, RUNNER_SIZE, RUNNER_COLOR, RUNNER_HP, RUNNER_ATK, RUNNER_SPEED);
        this.aiState = 'MOVE_TO_PRINCESS';
    }

    updateAI(
        princess: Phaser.GameObjects.Rectangle,
        player: Phaser.GameObjects.Rectangle
    ): void {
        if (this.isDead) return;

        const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

        // FSM 전환 (히스테리시스: 진입 300px, 이탈 400px)
        if (this.aiState === 'MOVE_TO_PRINCESS' && distToPlayer <= RUNNER_DETECT_RANGE) {
            this.aiState = 'CHASE_PLAYER';
        } else if (this.aiState === 'CHASE_PLAYER' && distToPlayer > RUNNER_RELEASE_RANGE) {
            this.aiState = 'MOVE_TO_PRINCESS';
        }

        const target = this.aiState === 'CHASE_PLAYER' ? player : princess;
        this.scene.physics.moveToObject(this, target, this.moveSpeed);
    }
}
