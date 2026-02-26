import Phaser from 'phaser';

export class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
    }

    preload() {
        // 여기에 나중에 캐릭터, 배경 이미지를 로드할 겁니다.
    }

    create() {
        this.add.text(400, 300, 'Fortem Game Start!', {
            fontSize: '48px',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.add.text(400, 380, 'Phaser 4 is Ready', {
            fontSize: '24px',
            color: '#00ff00'
        }).setOrigin(0.5);
    }
}
