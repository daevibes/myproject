import * as Phaser from 'phaser';
import { Monster } from './Monster';
import { Player } from './Player';
import { MONSTER_FLASH_DURATION } from '../config/constants';

export type BossGimmick =
    | 'charge'       // 직선 돌격
    | 'web_slow'     // 거미줄 투사체
    | 'revive'       // HP 0 시 50% 부활
    | 'hp_regen'     // 지속 HP 재생
    | 'blink'        // 점멸 회피
    | 'fire_zone'    // 화염장판 생성
    | 'dash'         // 2초 캐스팅 후 돌진
    | 'breath'       // 광역 브레스
    | 'frost_slow'   // 타격 시 이속/공속 감소
    | 'summon'       // 소형 악마 소환
    | 'multi_phase'; // 복합 페이즈

interface BossConfig {
    name: string;
    baseHp: number;
    baseAtk: number;
    moveSpeed: number;
    color: number;
    size: number;
    gimmick: BossGimmick;
    gimmickCooldown: number; // ms
}

export const BOSS_CONFIGS: BossConfig[] = [
    { name: '오크 대장',     baseHp: 300, baseAtk: 18, moveSpeed:  65, color: 0x44aa44, size: 52, gimmick: 'charge',      gimmickCooldown: 3000 },
    { name: '독 거미 여왕',  baseHp: 280, baseAtk: 15, moveSpeed:  85, color: 0x226622, size: 48, gimmick: 'web_slow',    gimmickCooldown: 2500 },
    { name: '해골 기사',     baseHp: 350, baseAtk: 20, moveSpeed:  60, color: 0xddddcc, size: 50, gimmick: 'revive',      gimmickCooldown: 99999 },
    { name: '피의 골렘',     baseHp: 500, baseAtk: 14, moveSpeed:  35, color: 0xcc2200, size: 60, gimmick: 'hp_regen',    gimmickCooldown: 1000 },
    { name: '그림자 암살자', baseHp: 260, baseAtk: 25, moveSpeed: 120, color: 0x222244, size: 44, gimmick: 'blink',       gimmickCooldown: 1800 },
    { name: '불꽃 술사',     baseHp: 320, baseAtk: 16, moveSpeed:  50, color: 0xff6600, size: 46, gimmick: 'fire_zone',   gimmickCooldown: 3500 },
    { name: '미노타우로스',  baseHp: 420, baseAtk: 22, moveSpeed:  75, color: 0x884400, size: 58, gimmick: 'dash',        gimmickCooldown: 4000 },
    { name: '타락한 드래곤', baseHp: 600, baseAtk: 20, moveSpeed:  45, color: 0x662288, size: 72, gimmick: 'breath',      gimmickCooldown: 3000 },
    { name: '빙결 마법사',   baseHp: 340, baseAtk: 18, moveSpeed:  50, color: 0x88ccff, size: 46, gimmick: 'frost_slow',  gimmickCooldown: 4000 },
    { name: '심연 악마',     baseHp: 460, baseAtk: 20, moveSpeed:  80, color: 0x440088, size: 56, gimmick: 'summon',      gimmickCooldown: 5000 },
    { name: '혼돈의 화신',   baseHp: 700, baseAtk: 24, moveSpeed:  90, color: 0xff0088, size: 68, gimmick: 'multi_phase', gimmickCooldown: 2000 },
];

export class Boss extends Monster {
    private bossConfig: BossConfig;
    private gimmickTimer: number = 0;
    private hasRevived: boolean = false;
    private isDashing: boolean = false;
    private dashTarget: { x: number; y: number } | null = null;
    private dashCastTime: number = 0;
    private phase: number = 1; // multi_phase용

    // 라벨
    private nameLabel: Phaser.GameObjects.Text;
    private hpBarBg: Phaser.GameObjects.Rectangle;
    private hpBarFill: Phaser.GameObjects.Rectangle;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        bossIndex: number,     // 0~10 (11마리)
        chapter: number,       // 챕터 배율용
        statsScale: number,    // 추가 스탯 배율
    ) {
        const cfg = BOSS_CONFIGS[bossIndex % BOSS_CONFIGS.length];
        const hp  = Math.round(cfg.baseHp  * statsScale);
        const atk = Math.round(cfg.baseAtk * statsScale);

        super(scene, x, y, cfg.size, cfg.color, hp, atk, cfg.moveSpeed);
        this.bossConfig = cfg;
        this.setDepth(5);

        // 보스 이름 라벨
        this.nameLabel = scene.add.text(x, y - cfg.size / 2 - 20, cfg.name, {
            fontSize: '13px', color: '#ffee44', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(20);

        // HP 바 (보스 머리 위)
        const barW = 80;
        this.hpBarBg   = scene.add.rectangle(x, y - cfg.size / 2 - 8, barW, 6, 0x440000).setDepth(20);
        this.hpBarFill = scene.add.rectangle(x - barW / 2, y - cfg.size / 2 - 8, barW, 6, 0xff2222)
            .setOrigin(0, 0.5).setDepth(21);

        // hp_regen: 주기적 회복
        if (cfg.gimmick === 'hp_regen') {
            scene.time.addEvent({
                delay: 1000,
                loop: true,
                callback: () => {
                    if (!this.isDead && this.active) {
                        this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * 0.02));
                    }
                },
            });
        }
    }

    override die(): void {
        // revive 기믹
        if (this.bossConfig.gimmick === 'revive' && !this.hasRevived) {
            this.hasRevived = true;
            this.hp = Math.round(this.maxHp * 0.5);
            // 부활 이펙트
            this.scene.tweens.add({
                targets: this,
                alpha: { from: 0.2, to: 1 },
                duration: 600,
                ease: 'Power2',
            });
            this.setFillStyle(0xffffff);
            this.scene.time.delayedCall(200, () => {
                if (!this.isDead) this.setFillStyle(this.bossConfig.color);
            });
            return; // 죽지 않음
        }

        // 보스 UI 정리
        this.nameLabel.destroy();
        this.hpBarBg.destroy();
        this.hpBarFill.destroy();

        // 보스 사망 이벤트
        this.scene.events.emit('boss-died', this.x, this.y);
        super.die();
    }

    override takeDamage(amount: number): void {
        super.takeDamage(amount);

        // frost_slow: 타격 시 플레이어 디버프 — takeDamage를 통해 피격 시 역으로 디버프 적용
        // (이 기믹은 updateAI에서 접촉 시 적용)

        // multi_phase: HP 50% 이하면 페이즈 2 전환
        if (this.bossConfig.gimmick === 'multi_phase' && this.phase === 1) {
            if (this.hp <= this.maxHp * 0.5) {
                this.phase = 2;
                this.setFillStyle(0xff4400);
                const flash = this.scene.add.text(
                    this.scene.cameras.main.width / 2,
                    this.scene.cameras.main.height / 2 - 60,
                    '혼돈의 화신 — PHASE 2!',
                    { fontSize: '22px', color: '#ff4400', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }
                ).setScrollFactor(0).setDepth(999).setOrigin(0.5);
                this.scene.time.delayedCall(2000, () => flash.destroy());
            }
        }
    }

    override updateAI(
        princess: Phaser.GameObjects.Rectangle,
        player: Phaser.GameObjects.Rectangle
    ): void {
        if (this.isDead || !this.active) return;

        // HP 바 위치 동기화
        this.nameLabel.setPosition(this.x, this.y - this.bossConfig.size / 2 - 20);
        this.hpBarBg.setPosition(this.x, this.y - this.bossConfig.size / 2 - 8);
        this.hpBarFill.setPosition(
            this.x - 40,
            this.y - this.bossConfig.size / 2 - 8
        );
        this.hpBarFill.width = 80 * Math.max(0, this.hp / this.maxHp);

        const time = this.scene.time.now;
        const gimmick = this.bossConfig.gimmick;

        // 대시 중인 경우 방향 유지
        if (this.isDashing && this.dashTarget) {
            const dx = this.dashTarget.x - this.x;
            const dy = this.dashTarget.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 30) {
                this.isDashing = false;
                this.body.setVelocity(0);
            }
            return;
        }

        // 기본 이동: 플레이어 추격
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
            const spd = this.moveSpeed;
            this.body.setVelocity((dx / dist) * spd, (dy / dist) * spd);
        } else {
            this.body.setVelocity(0);
        }

        // 기믹 타이머 체크
        if (time - this.gimmickTimer < this.bossConfig.gimmickCooldown) return;
        this.gimmickTimer = time;

        this.executeGimmick(gimmick, player);

        // multi_phase 페이즈 2: 추가 기믹
        if (gimmick === 'multi_phase' && this.phase === 2) {
            this.executeGimmick('fire_zone', player);
        }
    }

    private executeGimmick(
        gimmick: BossGimmick,
        player: Phaser.GameObjects.Rectangle
    ): void {
        switch (gimmick) {
            case 'charge':
            case 'multi_phase': // phase 1은 charge
                this.doCharge(player);
                break;

            case 'web_slow':
                this.scene.events.emit('boss-web-projectile', this.x, this.y, player.x, player.y);
                break;

            case 'fire_zone':
                this.scene.events.emit('boss-fire-zone', player.x, player.y);
                break;

            case 'blink':
                this.doBlink(player);
                break;

            case 'dash':
                this.doDashCast(player);
                break;

            case 'breath':
                this.doBreath(player);
                break;

            case 'frost_slow':
                this.doFrostSlow(player as Player);
                break;

            case 'summon':
                this.scene.events.emit('boss-summon', this.x, this.y);
                break;
        }
    }

    private doCharge(player: Phaser.GameObjects.Rectangle): void {
        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const chargeSpeed = 500;
        this.body.setVelocity(Math.cos(angle) * chargeSpeed, Math.sin(angle) * chargeSpeed);
        // 0.8초 후 속도 복원
        this.scene.time.delayedCall(800, () => {
            if (!this.isDead && this.active) this.body.setVelocity(0);
        });
    }

    private doBlink(player: Phaser.GameObjects.Rectangle): void {
        // 플레이어 근처 랜덤 위치로 순간이동
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 60;
        const nx = Phaser.Math.Clamp(player.x + Math.cos(angle) * dist, 0, this.scene.physics.world.bounds.right);
        const ny = Phaser.Math.Clamp(player.y + Math.sin(angle) * dist, 0, this.scene.physics.world.bounds.bottom);
        this.setAlpha(0.1);
        this.scene.time.delayedCall(150, () => {
            if (!this.isDead && this.active) {
                this.setPosition(nx, ny);
                this.setAlpha(1);
            }
        });
    }

    private doDashCast(player: Phaser.GameObjects.Rectangle): void {
        if (this.isDashing) return;
        // 캐스팅 표시 (2초)
        const castIndicator = this.scene.add.text(this.x, this.y - this.bossConfig.size / 2 - 40, '!!', {
            fontSize: '20px', color: '#ff0000', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(30);

        // 캐스팅 중 정지
        this.body.setVelocity(0);

        this.scene.time.delayedCall(2000, () => {
            castIndicator.destroy();
            if (!this.isDead && this.active) {
                this.isDashing = true;
                this.dashTarget = { x: player.x, y: player.y };
                const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
                this.body.setVelocity(Math.cos(angle) * 600, Math.sin(angle) * 600);
                this.scene.time.delayedCall(800, () => {
                    this.isDashing = false;
                    if (!this.isDead && this.active) this.body.setVelocity(0);
                });
            }
        });
    }

    private doBreath(player: Phaser.GameObjects.Rectangle): void {
        // 플레이어 방향 넓은 부채꼴 브레스 (시각적 이펙트 + 이벤트)
        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const g = this.scene.add.graphics().setDepth(15);
        g.fillStyle(0xff6600, 0.45);
        g.beginPath();
        g.moveTo(this.x, this.y);
        const startA = angle - Phaser.Math.DegToRad(50);
        const endA   = angle + Phaser.Math.DegToRad(50);
        for (let a = startA; a <= endA; a += 0.05) {
            g.lineTo(this.x + Math.cos(a) * 180, this.y + Math.sin(a) * 180);
        }
        g.closePath();
        g.fillPath();

        // 브레스 범위 내 플레이어 데미지 이벤트
        this.scene.events.emit('boss-breath', this.x, this.y, angle, 180, 100);

        this.scene.time.delayedCall(600, () => g.destroy());
    }

    private doFrostSlow(player: Player): void {
        if (!player.active) return;
        player.slowMultiplier = 0.5;
        player.atkCooldownMultiplier = 1.5;

        // 빙결 이펙트
        const frost = this.scene.add.rectangle(player.x, player.y, 40, 40, 0x88ccff, 0.4)
            .setDepth(100);
        this.scene.tweens.add({
            targets: frost,
            alpha: 0,
            duration: 2000,
            onComplete: () => frost.destroy(),
        });

        this.scene.time.delayedCall(2000, () => {
            if (player.active) {
                player.slowMultiplier = 1.0;
                player.atkCooldownMultiplier = 1.0;
            }
        });
    }
}
