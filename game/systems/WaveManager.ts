import * as Phaser from 'phaser';
import { SpawnSystem } from './SpawnSystem';
import { Monster } from '../entities/Monster';
import { WAVE_REST_TIME, WAVE_HP_SCALE, WAVE_SPEED_SCALE } from '../config/constants';

interface WaveConfig {
    infantry: number;
    runner: number;
}

const WAVE_TABLE: WaveConfig[] = [
    { infantry: 4,  runner: 0 },   // Wave 1
    { infantry: 5,  runner: 1 },   // Wave 2
    { infantry: 6,  runner: 2 },   // Wave 3
    { infantry: 6,  runner: 3 },   // Wave 4
    { infantry: 7,  runner: 4 },   // Wave 5
    { infantry: 7,  runner: 5 },   // Wave 6
    { infantry: 8,  runner: 5 },   // Wave 7
    { infantry: 8,  runner: 6 },   // Wave 8
    { infantry: 8,  runner: 7 },   // Wave 9
    { infantry: 6,  runner: 10 },  // Wave 10 (finale)
];

export class WaveManager {
    private scene: Phaser.Scene;
    private spawnSystem: SpawnSystem;
    private monsters: Monster[];
    private currentWave: number = 0;
    private totalWaves: number;
    private waveActive: boolean = false;
    private countdownText: Phaser.GameObjects.Text | null = null;
    private destroyed: boolean = false;

    constructor(scene: Phaser.Scene, spawnSystem: SpawnSystem, monsters: Monster[]) {
        this.scene = scene;
        this.spawnSystem = spawnSystem;
        this.monsters = monsters;
        this.totalWaves = WAVE_TABLE.length;
    }

    start(): void {
        this.currentWave = 0;
        this.startNextWave();
    }

    getCurrentWave(): number {
        return this.currentWave;
    }

    getTotalWaves(): number {
        return this.totalWaves;
    }

    isWaveActive(): boolean {
        return this.waveActive;
    }

    onMonsterDied(): void {
        if (!this.waveActive || this.destroyed) return;

        const alive = this.monsters.filter((m) => !m.isDead && m.active).length;
        if (alive <= 0) {
            this.waveActive = false;
            this.scene.events.emit('wave-clear', this.currentWave);

            if (this.currentWave >= this.totalWaves) {
                this.scene.events.emit('game-victory');
            } else {
                this.startCountdown();
            }
        }
    }

    private startCountdown(): void {
        if (this.destroyed) return;

        let remaining = Math.ceil(WAVE_REST_TIME / 1000);
        const camW = this.scene.cameras.main.width;
        const camH = this.scene.cameras.main.height;

        this.countdownText = this.scene.add.text(camW / 2, camH / 2, '', {
            fontSize: '32px', color: '#ffcc00', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(998);

        this.countdownText.setText(`Wave ${this.currentWave + 1}  in  ${remaining}s`);

        const timer = this.scene.time.addEvent({
            delay: 1000,
            repeat: remaining - 1,
            callback: () => {
                if (this.destroyed) { timer.remove(); return; }
                remaining--;
                if (remaining > 0) {
                    this.countdownText?.setText(`Wave ${this.currentWave + 1}  in  ${remaining}s`);
                } else {
                    this.countdownText?.destroy();
                    this.countdownText = null;
                    this.startNextWave();
                }
            },
        });
    }

    private startNextWave(): void {
        if (this.destroyed) return;
        if (this.currentWave >= this.totalWaves) return;

        this.currentWave++;
        this.waveActive = true;

        const config = WAVE_TABLE[this.currentWave - 1];
        const hpScale = 1 + WAVE_HP_SCALE * (this.currentWave - 1);
        const speedScale = 1 + WAVE_SPEED_SCALE * (this.currentWave - 1);

        this.spawnSystem.spawnWave(config.infantry, config.runner, hpScale, speedScale);

        this.scene.events.emit('wave-start', this.currentWave);

        this.showWaveBanner();
    }

    private showWaveBanner(): void {
        const camW = this.scene.cameras.main.width;
        const camH = this.scene.cameras.main.height;

        const banner = this.scene.add.text(camW / 2, camH / 2 - 40, `— WAVE ${this.currentWave} —`, {
            fontSize: '36px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(998).setAlpha(0);

        this.scene.tweens.add({
            targets: banner,
            alpha: 1,
            duration: 300,
            yoyo: true,
            hold: 1200,
            onComplete: () => banner.destroy(),
        });
    }

    destroy(): void {
        this.destroyed = true;
        this.waveActive = false;
        this.countdownText?.destroy();
        this.countdownText = null;
    }
}
