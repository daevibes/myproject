import * as Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Monster } from '../entities/Monster';
import {
    PLAYER_ATK,
    PLAYER_ATK_RANGE,
    PLAYER_ATK_ARC,
    HITSTOP_DURATION,
    KNOCKBACK_SPEED,
    KNOCKBACK_DURATION,
    SCREEN_SHAKE_INTENSITY,
    SCREEN_SHAKE_DURATION,
    DAMAGE_POPUP_DURATION,
    DAMAGE_POPUP_RISE,
} from '../config/constants';

export class CombatSystem {
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    /** 부채꼴 판정 */
    isInArc(
        ax: number, ay: number,
        tx: number, ty: number,
        facingAngle: number,
        range: number,
        arcDeg: number
    ): boolean {
        const dist = Phaser.Math.Distance.Between(ax, ay, tx, ty);
        if (dist > range) return false;

        const angleToTarget = Phaser.Math.Angle.Between(ax, ay, tx, ty);
        const angleDiff = Phaser.Math.Angle.Wrap(angleToTarget - facingAngle);
        const halfArc = Phaser.Math.DegToRad(arcDeg / 2);

        return Math.abs(angleDiff) <= halfArc;
    }

    /** 플레이어 공격 실행: 범위 내 몬스터 히트 처리 */
    performAttack(player: Player, monsters: Monster[]): void {
        let hitCount = 0;

        monsters.forEach((monster) => {
            if (monster.isDead || !monster.active) return;

            if (this.isInArc(
                player.x, player.y,
                monster.x, monster.y,
                player.facingAngle,
                PLAYER_ATK_RANGE,
                PLAYER_ATK_ARC
            )) {
                const totalAtk = PLAYER_ATK + player.bonusAtk;
                monster.takeDamage(totalAtk);
                this.showDamagePopup(monster.x, monster.y - 20, totalAtk);
                this.applyKnockback(monster, player.x, player.y);
                hitCount++;
            }
        });

        // 슬래시 이펙트 (항상 표시)
        this.showSlashEffect(player.x, player.y, player.facingAngle);

        if (hitCount > 0) {
            this.applyHitstop();
            this.applyScreenShake();
        }
    }

    /** 슬래시 이펙트: 흰색 호 */
    private showSlashEffect(x: number, y: number, angle: number): void {
        const g = this.scene.add.graphics();
        g.lineStyle(3, 0xffffff, 1);

        const startAngle = angle - Phaser.Math.DegToRad(PLAYER_ATK_ARC / 2);
        const endAngle = angle + Phaser.Math.DegToRad(PLAYER_ATK_ARC / 2);

        g.beginPath();
        g.arc(x, y, PLAYER_ATK_RANGE, startAngle, endAngle, false);
        g.strokePath();

        // 100ms 후 소멸
        this.scene.time.delayedCall(100, () => {
            g.destroy();
        });
    }

    /** 히트스탑 */
    private applyHitstop(): void {
        this.scene.physics.pause();
        this.scene.time.delayedCall(HITSTOP_DURATION, () => {
            this.scene.physics.resume();
        });
    }

    /** 넉백 */
    private applyKnockback(monster: Monster, fromX: number, fromY: number): void {
        if (monster.isDead || !monster.body) return;
        const angle = Phaser.Math.Angle.Between(fromX, fromY, monster.x, monster.y);
        monster.body.setVelocity(
            Math.cos(angle) * KNOCKBACK_SPEED,
            Math.sin(angle) * KNOCKBACK_SPEED
        );
        this.scene.time.delayedCall(KNOCKBACK_DURATION, () => {
            if (!monster.isDead && monster.body) {
                monster.body.setVelocity(0);
            }
        });
    }

    /** 화면 흔들림 */
    private applyScreenShake(): void {
        this.scene.cameras.main.shake(SCREEN_SHAKE_DURATION, SCREEN_SHAKE_INTENSITY / 1000);
    }

    /** 데미지 팝업 */
    private showDamagePopup(x: number, y: number, damage: number): void {
        const text = this.scene.add.text(x, y, `-${damage}`, {
            fontSize: '16px',
            color: '#ff4444',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        // 미니맵에서 안 보이도록 depth 설정
        text.setDepth(1000);

        this.scene.tweens.add({
            targets: text,
            y: y - DAMAGE_POPUP_RISE,
            alpha: 0,
            duration: DAMAGE_POPUP_DURATION,
            onComplete: () => text.destroy(),
        });
    }
}
