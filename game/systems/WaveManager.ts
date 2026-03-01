import * as Phaser from 'phaser';
import { SpawnSystem } from './SpawnSystem';
import { Monster } from '../entities/Monster';
import {
    WAVE_REST_TIME,
    WAVE_HP_SCALE,
    WAVE_SPEED_SCALE,
    MONSTER_SPEED_SCALE_CAP,
    BOSS_WAVE_INTERVAL,
    BOSS_CHAPTER_HP_SCALE,
    BOSS_CHAPTER_ATK_SCALE,
    CHAPTER_MON_HP_SCALE,
    CHAPTER_MON_ATK_SCALE,
} from '../config/constants';

/**
 * 8-Wave 챕터 루프
 *  Wave 1~3  : Infantry 소량 (탐색전)
 *  Wave 4    : Elite 1~2마리 확정 스폰
 *  Wave 5~7  : 스폰 속도·물량 2배 (호드 러시)
 *  Wave 8    : 챕터 보스 확정 스폰
 *
 * 챕터(chapter = 0~) : 8의 배수마다 1씩 증가
 * chapter → bossIndex (0~10, 이후 재순환)
 */
export class WaveManager {
    private scene: Phaser.Scene;
    private spawnSystem: SpawnSystem;
    private monsters: Monster[];
    private currentWave: number = 0;
    private waveActive: boolean = false;
    private countdownText: Phaser.GameObjects.Text | null = null;
    private destroyed: boolean = false;

    // 현재 챕터 보스가 살아있는지 추적
    private bossAlive: boolean = false;

    constructor(scene: Phaser.Scene, spawnSystem: SpawnSystem, monsters: Monster[]) {
        this.scene = scene;
        this.spawnSystem = spawnSystem;
        this.monsters = monsters;

        // 보스 처치 이벤트
        this.scene.events.on('boss-died', () => {
            this.bossAlive = false;
            this.onMonsterDied(); // 웨이브 종료 조건 체크
        });
    }

    start(): void {
        this.currentWave = 0;
        this.startNextWave();
    }

    getCurrentWave(): number {
        return this.currentWave;
    }

    /** 무한 루프이므로 totalWaves = Infinity (HUD 표시용 챕터 반환) */
    getChapter(): number {
        return Math.floor((this.currentWave - 1) / BOSS_WAVE_INTERVAL);
    }

    isWaveActive(): boolean {
        return this.waveActive;
    }

    onMonsterDied(): void {
        if (!this.waveActive || this.destroyed) return;

        const alive = this.monsters.filter((m) => !m.isDead && m.active).length;
        const isBossWave = this.getWaveInChapter() === BOSS_WAVE_INTERVAL;

        // 보스 웨이브: 보스 + 일반 몬스터 전부 죽어야 종료
        if (isBossWave && this.bossAlive) return;

        if (alive <= 0) {
            this.waveActive = false;

            const isBossJustCleared = isBossWave && !this.bossAlive;
            this.scene.events.emit('wave-clear', this.currentWave);

            if (isBossJustCleared) {
                // 여신의 가호 — MainScene에서 처리
                this.scene.events.emit('boss-wave-clear', this.currentWave);
            }

            this.startCountdown();
        }
    }

    private getWaveInChapter(): number {
        return ((this.currentWave - 1) % BOSS_WAVE_INTERVAL) + 1;
    }

    private startCountdown(): void {
        if (this.destroyed) return;

        let remaining = Math.ceil(WAVE_REST_TIME / 1000);
        const camW = this.scene.cameras.main.width;
        const camH = this.scene.cameras.main.height;

        const nextWaveNum = this.currentWave + 1;
        const nextInChapter = ((nextWaveNum - 1) % BOSS_WAVE_INTERVAL) + 1;
        const isBossNext = nextInChapter === BOSS_WAVE_INTERVAL;
        const label = isBossNext ? `보스 웨이브  in` : `Wave ${nextWaveNum}  in`;

        this.countdownText = this.scene.add.text(camW / 2, camH / 2, '', {
            fontSize: '28px', color: isBossNext ? '#ff4444' : '#ffcc00', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(998);

        this.countdownText.setText(`${label}  ${remaining}s`);

        const timer = this.scene.time.addEvent({
            delay: 1000,
            repeat: remaining - 1,
            callback: () => {
                if (this.destroyed) { timer.remove(); return; }
                remaining--;
                if (remaining > 0) {
                    this.countdownText?.setText(`${label}  ${remaining}s`);
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

        this.currentWave++;
        this.waveActive = true;

        const waveInChapter = this.getWaveInChapter();
        const chapter = Math.floor((this.currentWave - 1) / BOSS_WAVE_INTERVAL);

        // 챕터에 따른 일반 몬스터 스탯 배율
        const chapterHpScale = Math.pow(CHAPTER_MON_HP_SCALE, chapter);
        const waveHpScale    = 1 + WAVE_HP_SCALE   * (this.currentWave - 1);
        const waveSpeedScale = Math.min(MONSTER_SPEED_SCALE_CAP, 1 + WAVE_SPEED_SCALE * (this.currentWave - 1));

        const hpScale    = chapterHpScale * waveHpScale;
        const speedScale = waveSpeedScale;

        const runnerBoost = Math.min(chapter, 4); // 챕터당 +1 runner, 최대 +4

        if (waveInChapter === BOSS_WAVE_INTERVAL) {
            // ── 보스 웨이브 ──
            this.bossAlive = true;

            // 보스 배율 (챕터가 높을수록 강함)
            const bossHpScale  = Math.pow(BOSS_CHAPTER_HP_SCALE,  chapter);
            const bossAtkScale = Math.pow(BOSS_CHAPTER_ATK_SCALE, chapter);
            const bossStatsScale = Math.max(bossHpScale, bossAtkScale);

            const bossIndex = chapter % 11; // 11마리 순환
            this.spawnSystem.spawnBoss(bossIndex, chapter, bossStatsScale, this.monsters);

            // 보스 웨이브에도 일반 몬스터
            this.spawnSystem.spawnWave(25, 4 + runnerBoost, hpScale, speedScale);

        } else if (waveInChapter === 4) {
            // ── Wave 4: Elite 확정 ──
            this.spawnSystem.spawnWave(35, 5 + runnerBoost, hpScale * 1.3, speedScale);

        } else if (waveInChapter >= 5) {
            // ── Wave 5~7: 호드 러시 ──
            this.spawnSystem.spawnWave(
                40 + (waveInChapter - 5) * 10,
                6 + (waveInChapter - 5) * 2 + runnerBoost,
                hpScale,
                speedScale
            );

        } else {
            // ── Wave 1~3: 탐색전 ──
            this.spawnSystem.spawnWave(
                25 + waveInChapter * 5,
                1 + waveInChapter + runnerBoost,
                hpScale,
                speedScale
            );
        }

        this.scene.events.emit('wave-start', this.currentWave);
        this.showWaveBanner(waveInChapter === BOSS_WAVE_INTERVAL);
    }

    private showWaveBanner(isBoss: boolean): void {
        const camW = this.scene.cameras.main.width;
        const camH = this.scene.cameras.main.height;

        const chapter = this.getChapter() + 1;
        const label = isBoss
            ? `— CHAPTER ${chapter} BOSS —`
            : `— WAVE ${this.currentWave} —`;

        const banner = this.scene.add.text(camW / 2, camH / 2 - 40, label, {
            fontSize: '34px',
            color: isBoss ? '#ff4444' : '#ffffff',
            fontStyle: 'bold',
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
        this.scene.events.off('boss-died');
    }
}
