import * as Phaser from 'phaser';
import {
    PLAYER_SIZE,
    PLAYER_SPEED,
    PLAYER_HP,
    PLAYER_ATK,
    PLAYER_ATK_COOLDOWN,
    PLAYER_IFRAME,
    MIN_DAMAGE_RATIO,
} from '../config/constants';
import { useGameStore } from '@/lib/store/useGameStore';

export class Player extends Phaser.GameObjects.Rectangle {
    declare body: Phaser.Physics.Arcade.Body;

    public hp: number;
    public maxHp: number;
    public bonusAtk: number;
    public defBonus: number;
    public speedBonus: number;
    public facingAngle: number;       // radian, 기본값: 아래(pi/2)
    public lastAttackTime: number;
    public isInvincible: boolean;

    // 디버프 (보스 기믹 등에서 적용)
    public slowMultiplier: number = 1.0;   // 이동속도 배율 (1.0 = 정상)
    public atkCooldownMultiplier: number = 1.0; // 공격속도 쿨다운 배율 (1.0 = 정상)

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: Record<string, Phaser.Input.Keyboard.Key>;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, PLAYER_SIZE, PLAYER_SIZE, 0x0000ff);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.body.setCollideWorldBounds(true);

        // 6슬롯 장비 스탯 집계
        const { equipped } = useGameStore.getState();
        let hpBonus = 0;
        let atkBonus = 0;
        let defBonus = 0;
        let speedBonus = 0;

        const seenUids = new Set<string>();
        for (const item of Object.values(equipped)) {
            if (!item || seenUids.has(item.uid)) continue;
            seenUids.add(item.uid);
            hpBonus    += item.def.hpBonus;
            atkBonus   += item.def.atkBonus;
            defBonus   += item.def.defBonus;
            speedBonus += item.def.speedBonus;
        }

        this.hp = PLAYER_HP + hpBonus;
        this.maxHp = PLAYER_HP + hpBonus;
        this.bonusAtk = atkBonus;
        this.defBonus = defBonus;
        this.speedBonus = speedBonus;
        this.facingAngle = Math.PI / 2;
        this.lastAttackTime = 0;
        this.isInvincible = false;

        if (scene.input.keyboard) {
            this.cursors = scene.input.keyboard.createCursorKeys();
            this.wasd = scene.input.keyboard.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
        }
    }

    canAttack(time: number): boolean {
        return time - this.lastAttackTime >= PLAYER_ATK_COOLDOWN * this.atkCooldownMultiplier;
    }

    recordAttack(time: number): void {
        this.lastAttackTime = time;
    }

    /** 가장 가까운 적 방향으로 facingAngle 갱신. 적이 없으면 이동 방향 유지. */
    aimAtNearest(monsters: { x: number; y: number; isDead: boolean; active: boolean }[]): void {
        let nearest: { x: number; y: number } | null = null;
        let minDist = Infinity;

        for (const m of monsters) {
            if (m.isDead || !m.active) continue;
            const dist = Phaser.Math.Distance.Between(this.x, this.y, m.x, m.y);
            if (dist < minDist) {
                minDist = dist;
                nearest = m;
            }
        }

        if (nearest) {
            this.facingAngle = Phaser.Math.Angle.Between(this.x, this.y, nearest.x, nearest.y);
        }
    }

    takeDamage(amount: number): void {
        if (this.isInvincible) return;
        const effectiveDmg = Math.max(Math.ceil(amount * MIN_DAMAGE_RATIO), amount - this.defBonus);
        this.hp = Math.max(0, this.hp - effectiveDmg);
        this.isInvincible = true;

        // 깜빡임 이펙트 (0.5초간, 0.1초 간격 5회)
        let count = 0;
        const blinkEvent = this.scene.time.addEvent({
            delay: 100,
            repeat: 4,
            callback: () => {
                this.alpha = this.alpha === 1 ? 0.3 : 1;
                count++;
                if (count >= 5) {
                    this.alpha = 1;
                }
            },
        });

        this.scene.time.delayedCall(PLAYER_IFRAME, () => {
            this.isInvincible = false;
            this.alpha = 1;
            blinkEvent.remove();
        });
    }

    handleMovement(): void {
        if (!this.body) return;
        this.body.setVelocity(0);

        let vx = 0;
        let vy = 0;

        if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
        else if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;

        if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
        else if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;

        if (vx !== 0 || vy !== 0) {
            this.facingAngle = Math.atan2(vy, vx);
            const len = Math.sqrt(vx * vx + vy * vy);
            const speed = (PLAYER_SPEED + this.speedBonus) * this.slowMultiplier;
            this.body.setVelocity(
                (vx / len) * speed,
                (vy / len) * speed
            );
        }
    }

    /** 총 공격력 (기본 + 보너스) */
    get totalAtk(): number {
        return PLAYER_ATK + this.bonusAtk;
    }
}
