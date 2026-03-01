import * as Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Monster } from '../entities/Monster';
import {
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

export type UltimateType = 'CircleShockwave' | 'MegaSwordBeam' | 'Whirlwind';

export class CombatSystem {
    private scene: Phaser.Scene;
    private whirlwindActive: boolean = false;

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

    /** 플레이어 공격 실행: 범위 내 몬스터 히트 처리. 히트 수 반환 */
    performAttack(player: Player, monsters: Monster[]): number {
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
                const dmg = player.totalAtk;
                monster.takeDamage(dmg);
                this.showDamagePopup(monster.x, monster.y - 20, dmg);
                this.applyKnockback(monster, player.x, player.y);
                hitCount++;
            }
        });

        this.showSlashEffect(player.x, player.y, player.facingAngle);

        if (hitCount > 0) {
            this.applyHitstop();
            this.applyScreenShake();
        }

        return hitCount;
    }

    /** 궁극기 발동 */
    castUltimate(type: UltimateType, player: Player, monsters: Monster[]): void {
        switch (type) {
            case 'CircleShockwave': this.castCircleShockwave(player, monsters); break;
            case 'MegaSwordBeam':   this.castMegaSwordBeam(player, monsters);   break;
            case 'Whirlwind':       this.castWhirlwind(player, monsters);       break;
        }
    }

    /** CircleShockwave: 반경 200px 전방향 넉백 + 스턴 */
    private castCircleShockwave(player: Player, monsters: Monster[]): void {
        const RANGE = 200;
        const DMG = player.totalAtk * 3;

        // 시각 이펙트
        const g = this.scene.add.graphics().setDepth(200);
        g.lineStyle(4, 0x88ccff, 1);
        g.strokeCircle(player.x, player.y, RANGE);
        this.scene.tweens.add({
            targets: g,
            alpha: 0,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 400,
            onComplete: () => g.destroy(),
        });

        let hitCount = 0;
        monsters.forEach((m) => {
            if (m.isDead || !m.active) return;
            const dist = Phaser.Math.Distance.Between(player.x, player.y, m.x, m.y);
            if (dist <= RANGE) {
                m.takeDamage(DMG);
                this.showDamagePopup(m.x, m.y - 20, DMG);
                // 강한 넉백
                const angle = Phaser.Math.Angle.Between(player.x, player.y, m.x, m.y);
                if (m.body) {
                    m.body.setVelocity(Math.cos(angle) * KNOCKBACK_SPEED * 2, Math.sin(angle) * KNOCKBACK_SPEED * 2);
                    this.scene.time.delayedCall(400, () => {
                        if (!m.isDead && m.body) m.body.setVelocity(0);
                    });
                }
                hitCount++;
            }
        });

        if (hitCount > 0) this.applyScreenShake();
    }

    /** MegaSwordBeam: 직선 관통 광선 */
    private castMegaSwordBeam(player: Player, monsters: Monster[]): void {
        const BEAM_LENGTH = 500;
        const BEAM_WIDTH = 30;
        const DMG = player.totalAtk * 4;
        const angle = player.facingAngle;

        const endX = player.x + Math.cos(angle) * BEAM_LENGTH;
        const endY = player.y + Math.sin(angle) * BEAM_LENGTH;

        // 시각 이펙트
        const g = this.scene.add.graphics().setDepth(200);
        g.lineStyle(BEAM_WIDTH, 0xffee44, 1);
        g.beginPath();
        g.moveTo(player.x, player.y);
        g.lineTo(endX, endY);
        g.strokePath();
        this.scene.tweens.add({
            targets: g,
            alpha: 0,
            duration: 350,
            onComplete: () => g.destroy(),
        });

        // 관통 판정: 직선 경로상의 몬스터
        monsters.forEach((m) => {
            if (m.isDead || !m.active) return;
            // 점과 선분 거리 계산
            const d = this.distPointToSegment(m.x, m.y, player.x, player.y, endX, endY);
            if (d <= BEAM_WIDTH / 2 + 20) {
                m.takeDamage(DMG);
                this.showDamagePopup(m.x, m.y - 20, DMG);
            }
        });

        this.applyScreenShake();
    }

    /** Whirlwind: 3초간 회전 연속 데미지 */
    private castWhirlwind(player: Player, monsters: Monster[]): void {
        if (this.whirlwindActive) return;
        this.whirlwindActive = true;

        const RANGE = 130;
        const TICK_DMG = Math.round(player.totalAtk * 0.8);
        const DURATION = 3000;
        const TICK = 300;
        const ticks = Math.floor(DURATION / TICK);

        // 회전 이펙트 그래픽
        const g = this.scene.add.graphics().setDepth(200);

        let tickCount = 0;
        const timer = this.scene.time.addEvent({
            delay: TICK,
            repeat: ticks - 1,
            callback: () => {
                if (!player.active) { timer.remove(); return; }

                // 회전 이펙트
                g.clear();
                g.lineStyle(3, 0xffcc00, 0.8);
                const rot = (tickCount / ticks) * Math.PI * 6;
                for (let i = 0; i < 3; i++) {
                    const a = rot + (i * Math.PI * 2) / 3;
                    g.beginPath();
                    g.arc(player.x, player.y, RANGE, a, a + Math.PI * 0.7, false);
                    g.strokePath();
                }

                // 데미지
                monsters.forEach((m) => {
                    if (m.isDead || !m.active) return;
                    const dist = Phaser.Math.Distance.Between(player.x, player.y, m.x, m.y);
                    if (dist <= RANGE) {
                        m.takeDamage(TICK_DMG);
                        this.showDamagePopup(m.x, m.y - 20, TICK_DMG);
                    }
                });

                tickCount++;
                if (tickCount >= ticks) {
                    g.destroy();
                    this.whirlwindActive = false;
                }
            },
        });
    }

    /** 점과 선분의 거리 */
    private distPointToSegment(
        px: number, py: number,
        ax: number, ay: number,
        bx: number, by: number
    ): number {
        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Phaser.Math.Distance.Between(px, py, ax, ay);
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
        return Phaser.Math.Distance.Between(px, py, ax + t * dx, ay + t * dy);
    }

    /** 슬래시 이펙트: 흰색 호 */
    private showSlashEffect(x: number, y: number, angle: number): void {
        const g = this.scene.add.graphics();
        g.lineStyle(3, 0xffffff, 1);

        const startAngle = angle - Phaser.Math.DegToRad(PLAYER_ATK_ARC / 2);
        const endAngle   = angle + Phaser.Math.DegToRad(PLAYER_ATK_ARC / 2);

        g.beginPath();
        g.arc(x, y, PLAYER_ATK_RANGE, startAngle, endAngle, false);
        g.strokePath();

        this.scene.time.delayedCall(100, () => g.destroy());
    }

    private applyHitstop(): void {
        this.scene.physics.pause();
        this.scene.time.delayedCall(HITSTOP_DURATION, () => {
            this.scene.physics.resume();
        });
    }

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

    private applyScreenShake(): void {
        this.scene.cameras.main.shake(SCREEN_SHAKE_DURATION, SCREEN_SHAKE_INTENSITY / 1000);
    }

    private showDamagePopup(x: number, y: number, damage: number): void {
        const text = this.scene.add.text(x, y, `-${damage}`, {
            fontSize: '16px',
            color: '#ff4444',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(1000);

        this.scene.tweens.add({
            targets: text,
            y: y - DAMAGE_POPUP_RISE,
            alpha: 0,
            duration: DAMAGE_POPUP_DURATION,
            onComplete: () => text.destroy(),
        });
    }
}
