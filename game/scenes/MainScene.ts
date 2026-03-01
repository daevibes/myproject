import * as Phaser from 'phaser';
import { mapA } from '../maps/mapA';
import {
    WORLD_WIDTH,
    WORLD_HEIGHT,
    VIEWPORT_WIDTH,
    PRINCESS_SIZE,
    MINIMAP_SIZE,
    PRINCESS_HP,
    CONTACT_DAMAGE_INTERVAL,
    VICTORY_BONUS_POINTS,
} from '../config/constants';
import { Player } from '../entities/Player';
import { Monster } from '../entities/Monster';
import { CombatSystem } from '../systems/CombatSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { ItemDropSystem } from '../systems/ItemDropSystem';
import { WaveManager } from '../systems/WaveManager';
import { useGameStore } from '@/lib/store/useGameStore';

export class MainScene extends Phaser.Scene {
    private player!: Player;
    private princess!: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
    private obstacleGroup!: Phaser.Physics.Arcade.StaticGroup;
    private monsters: Monster[] = [];
    private combatSystem!: CombatSystem;
    private spawnSystem!: SpawnSystem;
    private itemDropSystem!: ItemDropSystem;
    private waveManager!: WaveManager;

    private princessHp: number = PRINCESS_HP;
    private spaceKey!: Phaser.Input.Keyboard.Key;

    // HUD — 플레이어 HP 바 (상단 고정)
    private playerHpBarBg!: Phaser.GameObjects.Rectangle;
    private playerHpBarFill!: Phaser.GameObjects.Rectangle;
    private playerHpLabel!: Phaser.GameObjects.Text;
    // HUD — 공주 HP 바 (월드 좌표, 공주 머리 위)
    private princessHpBarBg!: Phaser.GameObjects.Rectangle;
    private princessHpBarFill!: Phaser.GameObjects.Rectangle;
    // HUD — 웨이브 + 남은 적
    private waveText!: Phaser.GameObjects.Text;
    private enemyCountText!: Phaser.GameObjects.Text;

    // 접촉 데미지 쿨다운 추적
    private lastPlayerContactTime: number = 0;
    private lastPrincessContactTime: number = 0;

    private isGameOver: boolean = false;
    private isPaused: boolean = false;
    private killCount: number = 0;
    private escKey!: Phaser.Input.Keyboard.Key;
    private pauseUI: Phaser.GameObjects.GameObject[] = [];

    constructor() {
        super('MainScene');
    }

    create() {
        const mapData = mapA;
        this.monsters = [];
        this.isGameOver = false;
        this.killCount = 0;
        this.princessHp = PRINCESS_HP;

        // --- Phase 1: 맵 설정 (기존 유지) ---
        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setBackgroundColor(mapData.backgroundColor);

        // 존 (다리 등 — 통과 가능)
        mapData.zones.forEach((z) => {
            this.add.rectangle(z.x, z.y, z.w, z.h, z.color);
        });

        // 장애물 (강 — 통과 불가)
        this.obstacleGroup = this.physics.add.staticGroup();
        mapData.obstacles.forEach((obs) => {
            const rect = this.add.rectangle(obs.x, obs.y, obs.w, obs.h, obs.color);
            this.obstacleGroup.add(rect);
        });

        // 공주 (고정)
        const princessRect = this.add.rectangle(
            mapData.princess.x,
            mapData.princess.y,
            PRINCESS_SIZE,
            PRINCESS_SIZE,
            0x00ff00
        );
        this.physics.add.existing(princessRect, true);
        this.princess = princessRect as Phaser.GameObjects.Rectangle & {
            body: Phaser.Physics.Arcade.Body;
        };

        // 플레이어
        this.player = new Player(this, mapData.playerSpawn.x, mapData.playerSpawn.y);

        // 스폰 포인트 표시
        mapData.spawnPoints.forEach((sp) => {
            this.add.circle(sp.x, sp.y, 10, 0xff0000);
        });

        // 충돌 설정
        this.physics.add.collider(this.player, this.obstacleGroup);
        this.physics.add.collider(this.player, this.princess);

        // 카메라
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.startFollow(this.player, true, 0.05, 0.05);

        // 미니맵
        const minimapZoom = Math.min(MINIMAP_SIZE / WORLD_WIDTH, MINIMAP_SIZE / WORLD_HEIGHT);
        const minimap = this.cameras
            .add(VIEWPORT_WIDTH - MINIMAP_SIZE - 20, 20, MINIMAP_SIZE, MINIMAP_SIZE)
            .setZoom(minimapZoom)
            .setName('minimap');
        minimap.setBackgroundColor(0x000000);
        minimap.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        minimap.startFollow(this.player);

        // --- Phase 2: 전투 시스템 ---
        this.combatSystem = new CombatSystem(this);
        this.spawnSystem = new SpawnSystem(this, mapData.spawnPoints, this.monsters, this.obstacleGroup);

        // --- Phase 5: 웨이브 시스템 ---
        this.waveManager = new WaveManager(this, this.spawnSystem, this.monsters);
        this.waveManager.start();

        this.events.on('game-victory', () => this.showVictory());

        // --- Phase 3: 아이템 드롭 시스템 ---
        this.itemDropSystem = new ItemDropSystem(this);
        this.events.on('monster-died', (x: number, y: number) => {
            this.killCount++;
            this.itemDropSystem.tryDrop(x, y);
            this.waveManager.onMonsterDied();
        });

        // 키 바인딩
        if (this.input.keyboard) {
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        }

        // --- Phase 6: HUD ---
        const hpBarW = 200;
        const hpBarH = 16;
        const hpBarX = 10;
        const hpBarY = 10;

        this.playerHpBarBg = this.add.rectangle(hpBarX + hpBarW / 2, hpBarY + hpBarH / 2, hpBarW, hpBarH, 0x440000)
            .setScrollFactor(0).setDepth(999).setOrigin(0.5);
        this.playerHpBarFill = this.add.rectangle(hpBarX, hpBarY, hpBarW, hpBarH, 0x00cc44)
            .setScrollFactor(0).setDepth(999).setOrigin(0, 0);
        this.playerHpLabel = this.add.text(hpBarX + hpBarW + 8, hpBarY, '', {
            fontSize: '14px', color: '#ffffff',
        }).setScrollFactor(0).setDepth(999);

        this.waveText = this.add.text(VIEWPORT_WIDTH / 2 - 80, hpBarY, '', {
            fontSize: '15px', color: '#ffcc66', fontStyle: 'bold',
        }).setScrollFactor(0).setDepth(999);
        this.enemyCountText = this.add.text(VIEWPORT_WIDTH / 2 + 60, hpBarY, '', {
            fontSize: '15px', color: '#ff8866',
        }).setScrollFactor(0).setDepth(999);

        const pHpBarW = 50;
        const pHpBarH = 6;
        this.princessHpBarBg = this.add.rectangle(
            this.princess.x, this.princess.y - PRINCESS_SIZE / 2 - 12,
            pHpBarW, pHpBarH, 0x440000
        ).setDepth(900).setOrigin(0.5);
        this.princessHpBarFill = this.add.rectangle(
            this.princess.x - pHpBarW / 2, this.princess.y - PRINCESS_SIZE / 2 - 12,
            pHpBarW, pHpBarH, 0x00cc44
        ).setDepth(900).setOrigin(0, 0.5);
    }

    update(time: number, _delta: number) {
        if (!this.player || this.isGameOver) return;

        if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.isPaused ? this.resumeGame() : this.pauseGame();
            return;
        }

        if (this.isPaused) return;

        // 플레이어 이동
        this.player.handleMovement();

        const aliveMonsters = this.monsters.filter((m) => !m.isDead && m.active);

        // 가장 가까운 적 방향으로 조준 (적이 있을 때만)
        this.player.aimAtNearest(aliveMonsters);

        // 스페이스바: 즉시 공격 (쿨다운 무시하고 리셋)
        if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.player.recordAttack(time);
            this.combatSystem.performAttack(this.player, aliveMonsters);
        }
        // 자동 공격: 쿨다운마다 자동 발동
        else if (aliveMonsters.length > 0 && this.player.canAttack(time)) {
            this.player.recordAttack(time);
            this.combatSystem.performAttack(this.player, aliveMonsters);
        }

        // 몬스터 AI + 충돌 처리
        for (let i = this.monsters.length - 1; i >= 0; i--) {
            const monster = this.monsters[i];
            if (monster.isDead || !monster.active) {
                // 죽은 몬스터 배열에서 정리 (destroy 완료 후)
                if (!monster.active) {
                    this.monsters.splice(i, 1);
                }
                continue;
            }

            // AI 업데이트
            monster.updateAI(this.princess, this.player);

            // 몬스터 → 플레이어 접촉 데미지
            if (this.checkOverlap(monster, this.player)) {
                if (time - this.lastPlayerContactTime >= CONTACT_DAMAGE_INTERVAL) {
                    this.player.takeDamage(monster.atk);
                    this.lastPlayerContactTime = time;

                    if (this.player.hp <= 0) {
                        this.gameOver('player');
                        return;
                    }
                }
            }

            // 몬스터 → 공주 접촉 데미지
            if (this.checkOverlap(monster, this.princess)) {
                if (time - this.lastPrincessContactTime >= CONTACT_DAMAGE_INTERVAL) {
                    this.princessHp -= monster.atk;
                    this.lastPrincessContactTime = time;

                    // 공주 피격 깜빡임
                    this.princess.setFillStyle(0xff0000);
                    this.time.delayedCall(100, () => {
                        this.princess.setFillStyle(0x00ff00);
                    });

                    if (this.princessHp <= 0) {
                        this.princessHp = 0;
                        this.gameOver('princess');
                        return;
                    }
                }
            }
        }

        // 아이템 픽업 체크
        this.itemDropSystem.update(this.player);

        // HUD 업데이트
        const hpRatio = Math.max(0, this.player.hp / this.player.maxHp);
        this.playerHpBarFill.width = 200 * hpRatio;
        this.playerHpBarFill.setFillStyle(this.getHpColor(hpRatio));
        this.playerHpLabel.setText(`${this.player.hp}/${this.player.maxHp}`);

        const pRatio = Math.max(0, this.princessHp / PRINCESS_HP);
        this.princessHpBarFill.width = 50 * pRatio;
        this.princessHpBarFill.setFillStyle(this.getHpColor(pRatio));

        const aliveCount = this.monsters.filter((m) => !m.isDead && m.active).length;
        this.waveText.setText(`Wave ${this.waveManager.getCurrentWave()}/${this.waveManager.getTotalWaves()}`);
        this.enemyCountText.setText(`적: ${aliveCount}`);
    }

    private pauseGame(): void {
        this.isPaused = true;
        this.physics.pause();

        const camW = this.cameras.main.width;
        const camH = this.cameras.main.height;

        const overlay = this.add.rectangle(camW / 2, camH / 2, camW, camH, 0x000000, 0.6)
            .setScrollFactor(0).setDepth(1000);

        const title = this.add.text(camW / 2, camH / 2 - 80, 'PAUSED', {
            fontSize: '36px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        const resumeBtn = this.add.rectangle(camW / 2, camH / 2, 220, 50, 0x2266cc)
            .setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true });
        const resumeLabel = this.add.text(camW / 2, camH / 2, '계속하기', {
            fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);

        resumeBtn.on('pointerover', () => resumeBtn.setFillStyle(0x3388ee));
        resumeBtn.on('pointerout', () => resumeBtn.setFillStyle(0x2266cc));
        resumeBtn.on('pointerdown', () => this.resumeGame());

        const quitBtn = this.add.rectangle(camW / 2, camH / 2 + 70, 220, 50, 0xcc3333)
            .setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true });
        const quitLabel = this.add.text(camW / 2, camH / 2 + 70, '종료하기', {
            fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);

        quitBtn.on('pointerover', () => quitBtn.setFillStyle(0xee4444));
        quitBtn.on('pointerout', () => quitBtn.setFillStyle(0xcc3333));
        quitBtn.on('pointerdown', () => {
            // 중도 종료 시에도 획득 아이템 저장
            this.flushAndSave();
            this.waveManager.destroy();
            this.events.removeAllListeners('monster-died');
            this.events.removeAllListeners('game-victory');
            this.scene.start('LobbyScene');
        });

        this.pauseUI = [overlay, title, resumeBtn, resumeLabel, quitBtn, quitLabel];
    }

    private resumeGame(): void {
        this.isPaused = false;
        this.physics.resume();
        this.pauseUI.forEach((obj) => obj.destroy());
        this.pauseUI = [];
    }

    private showVictory(): void {
        if (this.isGameOver) return;
        this.isGameOver = true;

        this.waveManager.destroy();
        this.physics.pause();

        // 이번 판 획득 아이템 일괄 저장
        this.flushAndSave();

        const store = useGameStore.getState();
        store.addPoints(VICTORY_BONUS_POINTS);

        const camW = this.cameras.main.width;
        const camH = this.cameras.main.height;

        const overlay = this.add.rectangle(camW / 2, camH / 2, camW, camH, 0x000000, 0.7)
            .setScrollFactor(0).setDepth(1000);
        overlay.alpha = 0;
        this.tweens.add({ targets: overlay, alpha: 1, duration: 400 });

        this.add.text(camW / 2, camH / 2 - 100, 'VICTORY!', {
            fontSize: '44px', color: '#44ff44', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        this.add.text(camW / 2, camH / 2 - 40, `처치: ${this.killCount}`, {
            fontSize: '20px', color: '#cccccc',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        this.add.text(camW / 2, camH / 2, `보상: +${VICTORY_BONUS_POINTS}pt`, {
            fontSize: '22px', color: '#ffcc00', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        const btn = this.add.rectangle(camW / 2, camH / 2 + 70, 220, 50, 0x22aa44)
            .setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true });
        this.add.text(camW / 2, camH / 2 + 70, '로비로 돌아가기', {
            fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);

        btn.on('pointerover', () => btn.setFillStyle(0x33cc55));
        btn.on('pointerout', () => btn.setFillStyle(0x22aa44));
        btn.on('pointerdown', () => {
            this.events.removeAllListeners('monster-died');
            this.events.removeAllListeners('game-victory');
            this.scene.start('LobbyScene');
        });
    }

    private gameOver(reason: 'player' | 'princess'): void {
        if (this.isGameOver) return;
        this.isGameOver = true;

        // 이번 판 획득 아이템 일괄 저장
        this.flushAndSave();

        this.waveManager.destroy();
        this.spawnSystem.destroy();

        for (const m of this.monsters) {
            if (!m.isDead && m.active && m.body) {
                m.body.setVelocity(0, 0);
            }
        }

        this.physics.pause();

        const camW = this.cameras.main.width;
        const camH = this.cameras.main.height;

        const overlay = this.add.rectangle(camW / 2, camH / 2, camW, camH, 0x000000, 0.7)
            .setScrollFactor(0)
            .setDepth(1000);
        overlay.alpha = 0;
        this.tweens.add({ targets: overlay, alpha: 1, duration: 400 });

        const title = reason === 'player' ? 'YOU DIED' : 'PRINCESS DEAD';
        const titleColor = reason === 'player' ? '#ff4444' : '#ff8844';

        this.add.text(camW / 2, camH / 2 - 80, title, {
            fontSize: '40px', color: titleColor, fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        const statsText = `처치: ${this.killCount}`;
        this.add.text(camW / 2, camH / 2 - 20, statsText, {
            fontSize: '20px', color: '#cccccc',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        const btn = this.add.rectangle(camW / 2, camH / 2 + 60, 220, 50, 0x22aa44)
            .setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true });
        this.add.text(camW / 2, camH / 2 + 60, '로비로 돌아가기', {
            fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);

        btn.on('pointerover', () => btn.setFillStyle(0x33cc55));
        btn.on('pointerout', () => btn.setFillStyle(0x22aa44));
        btn.on('pointerdown', () => {
            this.events.removeAllListeners('monster-died');
            this.events.removeAllListeners('game-victory');
            this.scene.start('LobbyScene');
        });
    }

    // pendingInventory → Zustand 이동 + 백그라운드 DB 일괄 저장
    private flushAndSave(): void {
        const store = useGameStore.getState();
        const pending = store.flushPendingInventory();
        if (pending.length === 0) return;

        const { userId, sessionToken } = store;
        if (!userId || !sessionToken) {
            console.warn('[BatchSave] 인증 정보 없음 — DB 저장 스킵 (아이템은 로컬에 보존)');
            return;
        }

        fetch('/api/inventory/batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
                game_user_id: userId,
                items: pending.map(item => ({
                    in_game_item_id: item.itemId,
                    item_uid: item.uid,
                })),
            }),
        }).catch((e: any) => console.error('[BatchSave] 실패:', e.message));
    }

    private getHpColor(ratio: number): number {
        if (ratio > 0.6) return 0x00cc44;
        if (ratio > 0.3) return 0xcccc00;
        return 0xcc2222;
    }

    private checkOverlap(
        obj1: Phaser.GameObjects.Rectangle,
        obj2: Phaser.GameObjects.Rectangle
    ): boolean {
        const b1 = (obj1 as any).body as Phaser.Physics.Arcade.Body;
        const b2 = (obj2 as any).body as Phaser.Physics.Arcade.Body;
        if (!b1 || !b2 || !b1.enable || !b2.enable) return false;

        return Phaser.Geom.Intersects.RectangleToRectangle(
            new Phaser.Geom.Rectangle(b1.x, b1.y, b1.width, b1.height),
            new Phaser.Geom.Rectangle(b2.x, b2.y, b2.width, b2.height)
        );
    }
}
