import * as Phaser from 'phaser';
import { mapA } from '../maps/mapA';
import {
    WORLD_WIDTH,
    WORLD_HEIGHT,
    VIEWPORT_WIDTH,
    VIEWPORT_HEIGHT,
    PRINCESS_SIZE,
    MINIMAP_SIZE,
    PRINCESS_HP,
    CONTACT_DAMAGE_INTERVAL,
    VICTORY_BONUS_POINTS,
    ATTACK_HOLD_INTERVAL,
    SKILL_GAUGE_MAX,
    SKILL_GAUGE_PER_HIT,
    HEAL_ORB_DROP_CHANCE,
} from '../config/constants';
import { Player } from '../entities/Player';
import { Monster } from '../entities/Monster';
import { CombatSystem, UltimateType } from '../systems/CombatSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { ItemDropSystem } from '../systems/ItemDropSystem';
import { WaveManager } from '../systems/WaveManager';
import { WebProjectile } from '../entities/WebProjectile';
import { FireZone } from '../entities/FireZone';
import { HealOrb } from '../entities/HealOrb';
import { rollBossDrops } from '../config/dropTable';
import { useGameStore } from '@/lib/store/useGameStore';

export class MainScene extends Phaser.Scene {
    private player!: Player;
    private princess!: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
    private obstacleGroup!: Phaser.Physics.Arcade.StaticGroup;
    private monsters: Monster[] = [];
    private webProjectiles: WebProjectile[] = [];
    private fireZones: FireZone[] = [];
    private healOrbs: HealOrb[] = [];
    private combatSystem!: CombatSystem;
    private spawnSystem!: SpawnSystem;
    private itemDropSystem!: ItemDropSystem;
    private waveManager!: WaveManager;

    private princessHp: number = PRINCESS_HP;
    private escKey!: Phaser.Input.Keyboard.Key;

    // HUD — 플레이어 HP 바
    private playerHpBarBg!: Phaser.GameObjects.Rectangle;
    private playerHpBarFill!: Phaser.GameObjects.Rectangle;
    private playerHpLabel!: Phaser.GameObjects.Text;
    // HUD — 스킬 게이지 바
    private skillGaugeBarBg!: Phaser.GameObjects.Rectangle;
    private skillGaugeBarFill!: Phaser.GameObjects.Rectangle;
    private skillGaugeLabel!: Phaser.GameObjects.Text;
    // HUD — 웨이브 + 남은 적
    private waveText!: Phaser.GameObjects.Text;
    private enemyCountText!: Phaser.GameObjects.Text;
    // HUD — 공주 HP 바 (월드 좌표)
    private princessHpBarBg!: Phaser.GameObjects.Rectangle;
    private princessHpBarFill!: Phaser.GameObjects.Rectangle;

    // 온스크린 버튼
    private attackBtn!: Phaser.GameObjects.Rectangle;
    private skillBtn!: Phaser.GameObjects.Rectangle;
    private attackBtnLabel!: Phaser.GameObjects.Text;
    private skillBtnLabel!: Phaser.GameObjects.Text;

    // 입력 상태
    private attackKey!: Phaser.Input.Keyboard.Key;
    private holdAttackTimer: Phaser.Time.TimerEvent | null = null;
    private isPointerDown: boolean = false;

    // 접촉 데미지 쿨다운
    private lastPlayerContactTime: number = 0;
    private lastPrincessContactTime: number = 0;

    private isGameOver: boolean = false;
    private isPaused: boolean = false;
    private killCount: number = 0;
    private pauseUI: Phaser.GameObjects.GameObject[] = [];

    constructor() {
        super('MainScene');
    }

    create() {
        this.physics.resume(); // 이전 씬에서 pause된 상태 방지

        const mapData = mapA;
        this.monsters = [];
        this.webProjectiles = [];
        this.fireZones = [];
        this.healOrbs = [];
        this.isGameOver = false;
        this.killCount = 0;
        this.princessHp = PRINCESS_HP;

        // --- 맵 설정 ---
        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setBackgroundColor(mapData.backgroundColor);

        mapData.zones.forEach((z) => {
            this.add.rectangle(z.x, z.y, z.w, z.h, z.color);
        });

        this.obstacleGroup = this.physics.add.staticGroup();
        mapData.obstacles.forEach((obs) => {
            const rect = this.add.rectangle(obs.x, obs.y, obs.w, obs.h, obs.color);
            this.obstacleGroup.add(rect);
        });

        const princessRect = this.add.rectangle(
            mapData.princess.x, mapData.princess.y, PRINCESS_SIZE, PRINCESS_SIZE, 0x00ff00
        );
        this.physics.add.existing(princessRect, true);
        this.princess = princessRect as Phaser.GameObjects.Rectangle & {
            body: Phaser.Physics.Arcade.Body;
        };

        this.player = new Player(this, mapData.playerSpawn.x, mapData.playerSpawn.y);

        mapData.spawnPoints.forEach((sp) => {
            this.add.circle(sp.x, sp.y, 10, 0xff0000);
        });

        this.physics.add.collider(this.player, this.obstacleGroup);
        this.physics.add.collider(this.player, this.princess);

        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.centerOn(this.player.x, this.player.y);
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

        const minimapZoom = Math.min(MINIMAP_SIZE / WORLD_WIDTH, MINIMAP_SIZE / WORLD_HEIGHT);
        const minimap = this.cameras
            .add(VIEWPORT_WIDTH - MINIMAP_SIZE - 20, 20, MINIMAP_SIZE, MINIMAP_SIZE)
            .setZoom(minimapZoom)
            .setName('minimap');
        minimap.setBackgroundColor(0x000000);
        minimap.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        minimap.startFollow(this.player);

        // --- 전투 시스템 ---
        this.combatSystem = new CombatSystem(this);
        this.spawnSystem = new SpawnSystem(this, mapData.spawnPoints, this.monsters, this.obstacleGroup);
        this.waveManager = new WaveManager(this, this.spawnSystem, this.monsters);
        this.waveManager.start();

        this.events.on('wave-clear', () => { /* HUD 업데이트는 update()에서 */ });
        this.events.on('boss-wave-clear', () => this.onBossCleared());

        // 보스 기믹 이벤트
        this.events.on('boss-web-projectile', (x: number, y: number, tx: number, ty: number) => {
            const wp = new WebProjectile(this, x, y, tx, ty);
            this.webProjectiles.push(wp);
        });
        this.events.on('boss-fire-zone', (x: number, y: number) => {
            const fz = new FireZone(this, x, y);
            this.fireZones.push(fz);
        });
        this.events.on('boss-breath', (bx: number, by: number, angle: number, range: number, dmg: number) => {
            this.handleBreathHit(bx, by, angle, range, dmg);
        });
        this.events.on('boss-summon', (bx: number, by: number) => {
            this.spawnSystem.spawnWave(2, 0, 0.7, 1.0);
        });

        // 아이템 드롭
        this.itemDropSystem = new ItemDropSystem(this);
        this.events.on('monster-died', (x: number, y: number) => {
            this.killCount++;
            this.itemDropSystem.tryDrop(x, y);
            // 체력 구슬 확률 드롭
            if (Math.random() < HEAL_ORB_DROP_CHANCE) {
                this.healOrbs.push(new HealOrb(this, x, y));
            }
            this.waveManager.onMonsterDied();
        });

        // 보스 확정 드롭
        this.events.on('boss-died', (x: number, y: number) => {
            const drops = rollBossDrops();
            for (const itemId of drops) {
                this.itemDropSystem.forceDrop(x, y, itemId);
            }
        });

        // --- 키 바인딩 ---
        if (this.input.keyboard) {
            this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
            this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        }

        // --- 우클릭 스킬 발동 (마우스 공격은 SPACE로 이동) ---
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (this.isPaused || this.isGameOver) return;
            if (this.isOverHudButton(pointer)) return;

            if (pointer.rightButtonDown()) {
                this.tryUltimate();
            }
        });

        // --- HUD 구성 ---
        this.buildHUD();

        // --- 온스크린 버튼 (항상 표시) ---
        this.buildOnscreenButtons();
    }

    update(time: number, _delta: number) {
        if (!this.player || this.isGameOver) return;

        if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.isPaused ? this.resumeGame() : this.pauseGame();
            return;
        }

        if (this.isPaused) return;

        // SPACE 공격 입력 처리
        if (this.attackKey && Phaser.Input.Keyboard.JustDown(this.attackKey)) {
            this.isPointerDown = true;
            this.doPlayerAttack();
            this.holdAttackTimer?.remove();
            this.holdAttackTimer = this.time.addEvent({
                delay: ATTACK_HOLD_INTERVAL,
                loop: true,
                callback: () => {
                    if (!this.isPaused && !this.isGameOver && this.isPointerDown) {
                        this.doPlayerAttack();
                    }
                },
            });
        }
        if (this.isPointerDown && this.attackKey && this.attackKey.isUp) {
            this.isPointerDown = false;
            this.holdAttackTimer?.remove();
            this.holdAttackTimer = null;
        }

        this.player.handleMovement();

        const aliveMonsters = this.monsters.filter((m) => !m.isDead && m.active);

        // 가장 가까운 적 방향으로 조준
        this.player.aimAtNearest(aliveMonsters);

        // 몬스터 AI + 충돌 처리
        for (let i = this.monsters.length - 1; i >= 0; i--) {
            const monster = this.monsters[i];
            if (monster.isDead || !monster.active) {
                if (!monster.active) this.monsters.splice(i, 1);
                continue;
            }

            monster.updateAI(this.princess, this.player);

            if (this.checkOverlap(monster, this.player)) {
                if (time - this.lastPlayerContactTime >= CONTACT_DAMAGE_INTERVAL) {
                    this.player.takeDamage(monster.atk);
                    this.lastPlayerContactTime = time;
                    if (this.player.hp <= 0) { this.gameOver('player'); return; }
                }
            }

            if (this.checkOverlap(monster, this.princess)) {
                if (time - this.lastPrincessContactTime >= CONTACT_DAMAGE_INTERVAL) {
                    this.princessHp -= monster.atk;
                    this.lastPrincessContactTime = time;
                    this.princess.setFillStyle(0xff0000);
                    this.time.delayedCall(100, () => this.princess.setFillStyle(0x00ff00));
                    if (this.princessHp <= 0) { this.princessHp = 0; this.gameOver('princess'); return; }
                }
            }
        }

        // Web projectile 업데이트
        for (let i = this.webProjectiles.length - 1; i >= 0; i--) {
            const wp = this.webProjectiles[i];
            if (wp.isExpired()) { this.webProjectiles.splice(i, 1); continue; }
            wp.update(this.player);
        }

        // Fire zone 업데이트
        for (let i = this.fireZones.length - 1; i >= 0; i--) {
            const fz = this.fireZones[i];
            if (fz.isExpired()) { this.fireZones.splice(i, 1); continue; }
            fz.update(this.player, time);
        }

        // 체력 구슬 픽업 + 정리
        for (let i = this.healOrbs.length - 1; i >= 0; i--) {
            const orb = this.healOrbs[i];
            if (orb.isExpired()) { this.healOrbs.splice(i, 1); continue; }
            orb.tryPickup(this.player);
        }

        // 아이템 픽업
        this.itemDropSystem.update(this.player);

        // HUD 업데이트
        this.updateHUD();
    }

    // ─── 공격 실행 ─────────────────────────────────────────────
    private doPlayerAttack(): void {
        if (this.isGameOver || this.isPaused) return;
        const aliveMonsters = this.monsters.filter((m) => !m.isDead && m.active);
        this.player.aimAtNearest(aliveMonsters);
        const hitCount = this.combatSystem.performAttack(this.player, aliveMonsters);
        if (hitCount > 0) {
            useGameStore.getState().addSkillGauge(hitCount * SKILL_GAUGE_PER_HIT);
        }
        this.player.recordAttack(this.time.now);
    }

    // ─── 궁극기 ────────────────────────────────────────────────
    private tryUltimate(): void {
        const store = useGameStore.getState();
        if (store.skillGauge < SKILL_GAUGE_MAX) return;

        const type = this.getUltimateType();
        if (!type) return;

        store.setSkillGauge(0);
        const aliveMonsters = this.monsters.filter((m) => !m.isDead && m.active);
        this.combatSystem.castUltimate(type, this.player, aliveMonsters);

        this.showUltimateBanner(type);
    }

    private getUltimateType(): UltimateType | null {
        const { equipped } = useGameStore.getState();
        const right = equipped.RightHand;
        const left  = equipped.LeftHand;

        // 창 (양손) 우선
        if (right?.def.isTwoHanded) return 'CircleShockwave';
        // 양손 모두 Sword → 쌍검
        if (right?.def.weaponType === 'Sword' && left?.def.weaponType === 'Sword') return 'Whirlwind';
        // 한손검
        if (right?.def.weaponType === 'Sword') return 'MegaSwordBeam';
        return null;
    }

    private showUltimateBanner(type: UltimateType): void {
        const labels: Record<UltimateType, string> = {
            CircleShockwave: '⚡ 원형 충격파!',
            MegaSwordBeam:   '✦ 메가 광선검!',
            Whirlwind:       '🌀 쌍검 회오리!',
        };
        const camW = this.cameras.main.width;
        const camH = this.cameras.main.height;
        const banner = this.add.text(camW / 2, camH / 2 - 80, labels[type], {
            fontSize: '28px', color: '#ffee00', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(999).setAlpha(0);
        this.tweens.add({
            targets: banner, alpha: 1, duration: 200,
            yoyo: true, hold: 900,
            onComplete: () => banner.destroy(),
        });
    }

    // ─── 여신의 가호 (보스 처치 보상) ─────────────────────────
    private onBossCleared(): void {
        const store = useGameStore.getState();

        // HP 100% 회복
        this.player.hp = this.player.maxHp;

        // 스킬 게이지 100%
        store.setSkillGauge(SKILL_GAUGE_MAX);

        // 획득 아이템 DB 저장
        this.flushAndSave();

        // 황금 상자 이펙트
        const camW = this.cameras.main.width;
        const camH = this.cameras.main.height;

        const overlay = this.add.rectangle(camW / 2, camH / 2, camW, camH, 0xffcc00, 0.15)
            .setScrollFactor(0).setDepth(990);
        this.tweens.add({
            targets: overlay, alpha: 0, duration: 1500,
            onComplete: () => overlay.destroy(),
        });

        const banner = this.add.text(camW / 2, camH / 2 - 50, '여신의 가호!', {
            fontSize: '32px', color: '#ffee44', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(999).setAlpha(0);

        const sub = this.add.text(camW / 2, camH / 2, 'HP 완전 회복  +  스킬 게이지 MAX', {
            fontSize: '16px', color: '#ffffff',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(999).setAlpha(0);

        this.tweens.add({
            targets: [banner, sub], alpha: 1, duration: 300,
            yoyo: true, hold: 1500,
            onComplete: () => { banner.destroy(); sub.destroy(); },
        });

        // 황금 아이템 드롭 (스폰 포인트 근처 아이템)
        store.addPoints(VICTORY_BONUS_POINTS);
    }

    // ─── 브레스 피격 처리 ───────────────────────────────────────
    private handleBreathHit(
        bx: number, by: number, angle: number, range: number, dmg: number
    ): void {
        const HALF_ARC_RAD = Phaser.Math.DegToRad(50);
        const px = this.player.x, py = this.player.y;
        const dist = Phaser.Math.Distance.Between(bx, by, px, py);
        if (dist > range) return;
        const toPlayer = Phaser.Math.Angle.Between(bx, by, px, py);
        const diff = Math.abs(Phaser.Math.Angle.Wrap(toPlayer - angle));
        if (diff <= HALF_ARC_RAD) {
            this.player.takeDamage(dmg);
        }
    }

    // ─── HUD 구성 ───────────────────────────────────────────────
    private buildHUD(): void {
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

        // 스킬 게이지 (HP 바 아래)
        const sgY = hpBarY + hpBarH + 4;
        const sgW = 200;
        const sgH = 10;
        this.skillGaugeBarBg = this.add.rectangle(hpBarX + sgW / 2, sgY + sgH / 2, sgW, sgH, 0x222244)
            .setScrollFactor(0).setDepth(999).setOrigin(0.5);
        this.skillGaugeBarFill = this.add.rectangle(hpBarX, sgY, 0, sgH, 0x8844ff)
            .setScrollFactor(0).setDepth(999).setOrigin(0, 0);
        this.skillGaugeLabel = this.add.text(hpBarX + sgW + 8, sgY, '', {
            fontSize: '11px', color: '#aa88ff',
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

    private updateHUD(): void {
        const hpRatio = Math.max(0, this.player.hp / this.player.maxHp);
        this.playerHpBarFill.width = 200 * hpRatio;
        this.playerHpBarFill.setFillStyle(this.getHpColor(hpRatio));
        this.playerHpLabel.setText(`${this.player.hp}/${this.player.maxHp}`);

        const pRatio = Math.max(0, this.princessHp / PRINCESS_HP);
        this.princessHpBarFill.width = 50 * pRatio;
        this.princessHpBarFill.setFillStyle(this.getHpColor(pRatio));

        const gauge = useGameStore.getState().skillGauge;
        this.skillGaugeBarFill.width = 200 * (gauge / SKILL_GAUGE_MAX);
        this.skillGaugeBarFill.setFillStyle(gauge >= SKILL_GAUGE_MAX ? 0xff88ff : 0x8844ff);
        this.skillGaugeLabel.setText(`${Math.floor(gauge)}%`);

        const aliveCount = this.monsters.filter((m) => !m.isDead && m.active).length;
        const chapter = this.waveManager.getChapter() + 1;
        const wave = this.waveManager.getCurrentWave();
        this.waveText.setText(`Ch.${chapter} W${wave}`);
        this.enemyCountText.setText(`적: ${aliveCount}`);

        // 스킬 버튼 색상 (사용 가능 여부)
        const canUlt = gauge >= SKILL_GAUGE_MAX && this.getUltimateType() !== null;
        this.skillBtn.setFillStyle(canUlt ? 0xaa44ff : 0x554466);
        this.skillBtnLabel.setColor(canUlt ? '#ffffff' : '#888888');
    }

    // ─── 온스크린 버튼 ──────────────────────────────────────────
    private buildOnscreenButtons(): void {
        const bW = 80, bH = 80;
        const margin = 20;
        const atkX = VIEWPORT_WIDTH - margin - bW * 2 - 10;
        const sktX = VIEWPORT_WIDTH - margin - bW;
        const btnY = VIEWPORT_HEIGHT - margin - bH / 2;

        // 공격 버튼
        this.attackBtn = this.add.rectangle(atkX, btnY, bW, bH, 0x2266cc, 0.85)
            .setScrollFactor(0).setDepth(1000).setInteractive({ useHandCursor: true });
        this.attackBtnLabel = this.add.text(atkX, btnY, '⚔\n공격', {
            fontSize: '14px', color: '#ffffff', align: 'center',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        this.attackBtn.on('pointerdown', () => {
            if (this.isPaused || this.isGameOver) return;
            this.doPlayerAttack();
            // 홀드 처리
            this.isPointerDown = true;
            this.holdAttackTimer?.remove();
            this.holdAttackTimer = this.time.addEvent({
                delay: ATTACK_HOLD_INTERVAL,
                loop: true,
                callback: () => {
                    if (!this.isPaused && !this.isGameOver && this.isPointerDown) {
                        this.doPlayerAttack();
                    }
                },
            });
        });
        this.attackBtn.on('pointerup', () => {
            this.isPointerDown = false;
            this.holdAttackTimer?.remove();
            this.holdAttackTimer = null;
        });
        this.attackBtn.on('pointerout', () => {
            this.isPointerDown = false;
            this.holdAttackTimer?.remove();
            this.holdAttackTimer = null;
        });

        // 스킬 버튼
        this.skillBtn = this.add.rectangle(sktX, btnY, bW, bH, 0x554466, 0.85)
            .setScrollFactor(0).setDepth(1000).setInteractive({ useHandCursor: true });
        this.skillBtnLabel = this.add.text(sktX, btnY, '✦\n스킬', {
            fontSize: '14px', color: '#888888', align: 'center',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        this.skillBtn.on('pointerdown', () => {
            if (this.isPaused || this.isGameOver) return;
            this.tryUltimate();
        });
    }

    /** 포인터가 HUD 온스크린 버튼 영역인지 체크 (카메라 좌표) */
    private isOverHudButton(pointer: Phaser.Input.Pointer): boolean {
        const bW = 80, bH = 80, margin = 20;
        const atkX = VIEWPORT_WIDTH - margin - bW * 2 - 10;
        const sktX = VIEWPORT_WIDTH - margin - bW;
        const btnY = VIEWPORT_HEIGHT - margin - bH / 2;
        const hw = bW / 2, hh = bH / 2;

        const px = pointer.x, py = pointer.y;
        const overAtk = px >= atkX - hw && px <= atkX + hw && py >= btnY - hh && py <= btnY + hh;
        const overSkt = px >= sktX - hw && px <= sktX + hw && py >= btnY - hh && py <= btnY + hh;
        return overAtk || overSkt;
    }

    // ─── 일시정지 ────────────────────────────────────────────────
    private pauseGame(): void {
        this.isPaused = true;
        this.physics.pause();
        this.isPointerDown = false;
        this.holdAttackTimer?.remove();
        this.holdAttackTimer = null;

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
        resumeBtn.on('pointerout',  () => resumeBtn.setFillStyle(0x2266cc));
        resumeBtn.on('pointerdown', () => this.resumeGame());

        // ESC 종료: 저장 없음 (아이템 증발 방지를 위해 저장 하지 않음)
        const quitBtn = this.add.rectangle(camW / 2, camH / 2 + 70, 220, 50, 0xcc3333)
            .setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true });
        const quitLabel = this.add.text(camW / 2, camH / 2 + 70, '종료 (아이템 미저장)', {
            fontSize: '16px', color: '#ffaaaa', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);

        quitBtn.on('pointerover', () => quitBtn.setFillStyle(0xee4444));
        quitBtn.on('pointerout',  () => quitBtn.setFillStyle(0xcc3333));
        quitBtn.on('pointerdown', () => {
            // ESC 종료 시 저장 없음
            this.cleanupCustomEvents();
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

    // ─── 승리 ──────────────────────────────────────────────────
    private showVictory(): void {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.waveManager.destroy();
        this.physics.pause();
        this.flushAndSave();

        useGameStore.getState().addPoints(VICTORY_BONUS_POINTS);

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

        const btn = this.add.rectangle(camW / 2, camH / 2 + 70, 220, 50, 0x22aa44)
            .setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true });
        this.add.text(camW / 2, camH / 2 + 70, '로비로 돌아가기', {
            fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
        btn.on('pointerover', () => btn.setFillStyle(0x33cc55));
        btn.on('pointerout',  () => btn.setFillStyle(0x22aa44));
        btn.on('pointerdown', () => {
            this.cleanupCustomEvents();
            this.scene.start('LobbyScene');
        });
    }

    // ─── 게임 오버 ──────────────────────────────────────────────
    private gameOver(reason: 'player' | 'princess'): void {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.flushAndSave();
        this.waveManager.destroy();
        this.spawnSystem.destroy();

        for (const m of this.monsters) {
            if (!m.isDead && m.active && m.body) m.body.setVelocity(0, 0);
        }
        this.physics.pause();

        const camW = this.cameras.main.width;
        const camH = this.cameras.main.height;
        const overlay = this.add.rectangle(camW / 2, camH / 2, camW, camH, 0x000000, 0.7)
            .setScrollFactor(0).setDepth(1000);
        overlay.alpha = 0;
        this.tweens.add({ targets: overlay, alpha: 1, duration: 400 });

        const title = reason === 'player' ? 'YOU DIED' : 'PRINCESS DEAD';
        const color = reason === 'player' ? '#ff4444' : '#ff8844';
        this.add.text(camW / 2, camH / 2 - 80, title, {
            fontSize: '40px', color, fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
        this.add.text(camW / 2, camH / 2 - 20, `처치: ${this.killCount}`, {
            fontSize: '20px', color: '#cccccc',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        const btn = this.add.rectangle(camW / 2, camH / 2 + 60, 220, 50, 0x22aa44)
            .setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true });
        this.add.text(camW / 2, camH / 2 + 60, '로비로 돌아가기', {
            fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
        btn.on('pointerover', () => btn.setFillStyle(0x33cc55));
        btn.on('pointerout',  () => btn.setFillStyle(0x22aa44));
        btn.on('pointerdown', () => {
            this.cleanupCustomEvents();
            this.scene.start('LobbyScene');
        });
    }

    /** 커스텀 이벤트만 선별 제거 (Phaser 내부 이벤트 보존) */
    private cleanupCustomEvents(): void {
        this.waveManager.destroy();
        this.events.removeAllListeners('monster-died');
        this.events.removeAllListeners('wave-clear');
        this.events.removeAllListeners('boss-wave-clear');
        this.events.removeAllListeners('boss-web-projectile');
        this.events.removeAllListeners('boss-fire-zone');
        this.events.removeAllListeners('boss-breath');
        this.events.removeAllListeners('boss-summon');
        this.events.removeAllListeners('boss-died');
    }

    // ─── 인벤토리 저장 ───────────────────────────────────────────
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

    // ─── 유틸 ───────────────────────────────────────────────────
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
