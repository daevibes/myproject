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
} from '../config/constants';
import { Player } from '../entities/Player';
import { Monster } from '../entities/Monster';
import { CombatSystem } from '../systems/CombatSystem';
import { SpawnSystem } from '../systems/SpawnSystem';

export class MainScene extends Phaser.Scene {
    private player!: Player;
    private princess!: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
    private obstacleGroup!: Phaser.Physics.Arcade.StaticGroup;
    private monsters: Monster[] = [];
    private combatSystem!: CombatSystem;
    private spawnSystem!: SpawnSystem;

    private princessHp: number = PRINCESS_HP;
    private spaceKey!: Phaser.Input.Keyboard.Key;

    // HUD 텍스트 (임시)
    private playerHpText!: Phaser.GameObjects.Text;
    private princessHpText!: Phaser.GameObjects.Text;

    // 접촉 데미지 쿨다운 추적
    private lastPlayerContactTime: number = 0;
    private lastPrincessContactTime: number = 0;

    constructor() {
        super('MainScene');
    }

    create() {
        const mapData = mapA;
        this.monsters = [];

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
        this.spawnSystem.start();

        // 스페이스바
        if (this.input.keyboard) {
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        }

        // 임시 HUD (스크롤 안 되는 고정 텍스트)
        this.playerHpText = this.add
            .text(10, 10, '', { fontSize: '16px', color: '#88ccff' })
            .setScrollFactor(0)
            .setDepth(999);
        this.princessHpText = this.add
            .text(10, 32, '', { fontSize: '16px', color: '#88ff88' })
            .setScrollFactor(0)
            .setDepth(999);
    }

    update(time: number, _delta: number) {
        if (!this.player || this.player.hp <= 0) return;

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
                        console.log('PLAYER DEAD');
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
                        console.log('GAME OVER');
                    }
                }
            }
        }

        // HUD 업데이트
        this.playerHpText.setText(`Player HP: ${this.player.hp}/${this.player.maxHp}`);
        this.princessHpText.setText(`Princess HP: ${this.princessHp}/${PRINCESS_HP}`);
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
