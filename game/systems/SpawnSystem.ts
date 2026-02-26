import * as Phaser from 'phaser';
import { Monster } from '../entities/Monster';
import { Infantry } from '../entities/Infantry';
import { Runner } from '../entities/Runner';
import { Position } from '../config/constants';
import {
    SPAWN_INTERVAL_INFANTRY,
    SPAWN_INTERVAL_RUNNER,
    SPAWN_MAX_MONSTERS,
    SPAWN_START_DELAY,
} from '../config/constants';

export class SpawnSystem {
    private scene: Phaser.Scene;
    private spawnPoints: Position[];
    private monsters: Monster[];
    private obstacleGroup: Phaser.Physics.Arcade.StaticGroup;
    private infantryTimer?: Phaser.Time.TimerEvent;
    private runnerTimer?: Phaser.Time.TimerEvent;

    constructor(
        scene: Phaser.Scene,
        spawnPoints: Position[],
        monsters: Monster[],
        obstacleGroup: Phaser.Physics.Arcade.StaticGroup
    ) {
        this.scene = scene;
        this.spawnPoints = spawnPoints;
        this.monsters = monsters;
        this.obstacleGroup = obstacleGroup;
    }

    start(): void {
        // 시작 딜레이 후 스폰 시작
        this.scene.time.delayedCall(SPAWN_START_DELAY, () => {
            this.infantryTimer = this.scene.time.addEvent({
                delay: SPAWN_INTERVAL_INFANTRY,
                callback: () => this.spawnInfantry(),
                loop: true,
            });

            this.runnerTimer = this.scene.time.addEvent({
                delay: SPAWN_INTERVAL_RUNNER,
                callback: () => this.spawnRunner(),
                loop: true,
            });

            // 첫 스폰 즉시
            this.spawnInfantry();
        });
    }

    private getAliveCount(): number {
        return this.monsters.filter((m) => !m.isDead && m.active).length;
    }

    private getRandomSpawnPoint(): Position {
        return Phaser.Utils.Array.GetRandom(this.spawnPoints);
    }

    private spawnInfantry(): void {
        if (this.getAliveCount() >= SPAWN_MAX_MONSTERS) return;
        const sp = this.getRandomSpawnPoint();
        const infantry = new Infantry(this.scene, sp.x, sp.y);
        this.scene.physics.add.collider(infantry, this.obstacleGroup);
        this.monsters.push(infantry);
    }

    private spawnRunner(): void {
        if (this.getAliveCount() >= SPAWN_MAX_MONSTERS) return;
        const sp = this.getRandomSpawnPoint();
        const runner = new Runner(this.scene, sp.x, sp.y);
        this.scene.physics.add.collider(runner, this.obstacleGroup);
        this.monsters.push(runner);
    }

    destroy(): void {
        this.infantryTimer?.remove();
        this.runnerTimer?.remove();
    }
}
