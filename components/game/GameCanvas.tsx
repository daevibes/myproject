"use client";

import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
// @ts-ignore - MainScene might not exist yet during initial setup
import { MainScene } from '@/game/scenes/MainScene';

export default function GameCanvas() {
    const gameRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && gameRef.current) {
            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.AUTO,
                parent: gameRef.current,
                width: 800,
                height: 600,
                backgroundColor: '#1a1a1a',
                scene: [MainScene],
                physics: {
                    default: 'arcade',
                    arcade: {
                        gravity: { x: 0, y: 0 }
                    }
                },
            };

            const game = new Phaser.Game(config);

            return () => {
                game.destroy(true);
            };
        }
    }, []);

    return <div ref={gameRef} className="rounded-xl overflow-hidden border-4 border-gray-800 shadow-2xl" />;
}
