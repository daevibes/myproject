"use client";

import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { MainScene } from '@/game/scenes/MainScene';

export default function GameCanvas() {
    const gameRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && gameRef.current) {
            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.AUTO,
                parent: gameRef.current,
                scale: {
                    mode: Phaser.Scale.FIT,
                    autoCenter: Phaser.Scale.CENTER_BOTH,
                    width: 1280,
                    height: 720,
                },
                backgroundColor: '#2d2d2d',
                scene: [MainScene],
                physics: {
                    default: 'arcade',
                    arcade: {
                        gravity: { x: 0, y: 0 },
                    }
                },
            };

            const game = new Phaser.Game(config);

            return () => {
                game.destroy(true);
            };
        }
    }, []);

    return <div ref={gameRef} className="rounded-xl overflow-hidden border-4 border-gray-800 shadow-2xl w-full h-full max-w-[1280px] max-h-[720px] mx-auto" />;
}
