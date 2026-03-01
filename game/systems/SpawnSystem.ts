import * as Phaser from 'phaser';
import { Monster } from '../entities/Monster';
import { Infantry } from '../entities/Infantry';
import { Runner } from '../entities/Runner';
import { Boss } from '../entities/Boss';
import { Position, SPAWN_MAX_MONSTERS } from '../config/constants';

export class SpawnSystem {
    private scene: Phaser.Scene;
    private spawnPoints: Position[];
    private monsters: Monster[];
    private obstacleGroup: Phaser.Physics.Arcade.StaticGroup;

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

    spawnWave(infantryCount: number, runnerCount: number, hpScale: number, speedScale: number): void {
        for (let i = 0; i < infantryCount; i++) {
            if (this.monsters.filter((m) => !m.isDead && m.active).length >= SPAWN_MAX_MONSTERS) break;
            const sp = this.getRandomSpawnPoint();
            const infantry = new Infantry(this.scene, sp.x, sp.y, hpScale, speedScale);
            this.scene.physics.add.collider(infantry, this.obstacleGroup);
            this.monsters.push(infantry);
        }

        for (let i = 0; i < runnerCount; i++) {
            if (this.monsters.filter((m) => !m.isDead && m.active).length >= SPAWN_MAX_MONSTERS) break;
            const sp = this.getRandomSpawnPoint();
            const runner = new Runner(this.scene, sp.x, sp.y, hpScale, speedScale);
            this.scene.physics.add.collider(runner, this.obstacleGroup);
            this.monsters.push(runner);
        }
    }

    /** 챕터 보스 스폰 */
    spawnBoss(
        bossIndex: number,
        chapter: number,
        statsScale: number,
        monstersArray: Monster[]
    ): void {
        const sp = this.getRandomSpawnPoint();
        const boss = new Boss(this.scene, sp.x, sp.y, bossIndex, chapter, statsScale);
        this.scene.physics.add.collider(boss, this.obstacleGroup);
        monstersArray.push(boss);
    }

    private getRandomSpawnPoint(): Position {
        return Phaser.Utils.Array.GetRandom(this.spawnPoints);
    }

    destroy(): void {
        // WaveManager handles timing; nothing to clean up here
    }
}
