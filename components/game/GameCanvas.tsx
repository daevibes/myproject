"use client";

import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { LobbyScene } from '@/game/scenes/LobbyScene';
import { MainScene } from '@/game/scenes/MainScene';
import { createClient } from '@/lib/supabase/client';
import { useGameStore } from '@/lib/store/useGameStore';
import { ITEM_DEFS } from '@/game/config/items';
import { INVENTORY_MAX_SLOTS } from '@/game/config/constants';

export default function GameCanvas() {
    const gameRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data }) => {
            const user = data.session?.user;
            const token = data.session?.access_token;
            if (user && token) {
                // Phaser 내부에서 접근 가능하도록 Zustand에 저장
                useGameStore.setState({ userId: user.id, sessionToken: token });

                // 재하이드레이션: DB 아이템 중 로컬에 없는 것만 Zustand에 병합
                try {
                    const res = await fetch(`/api/inventory?game_user_id=${user.id}`);
                    const { items } = await res.json();
                    if (Array.isArray(items)) {
                        const store = useGameStore.getState();
                        const localUids = new Set(store.inventory.map(i => i.uid));
                        const newItems = items
                            .filter(dbItem => !localUids.has(dbItem.item_uid))
                            .map(dbItem => ({
                                uid: dbItem.item_uid,
                                itemId: dbItem.in_game_item_id,
                                def: ITEM_DEFS[dbItem.in_game_item_id],
                            }))
                            .filter(item => item.def != null);
                        if (newItems.length > 0) {
                            useGameStore.setState(s => ({
                                inventory: [...s.inventory, ...newItems].slice(0, INVENTORY_MAX_SLOTS),
                            }));
                        }
                    }
                } catch (e) {
                    console.warn('[Rehydration] DB 인벤토리 로드 실패:', e);
                }
            }
            setReady(true);
        });
    }, []);

    useEffect(() => {
        if (!ready || typeof window === 'undefined' || !gameRef.current) return;

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
            scene: [LobbyScene, MainScene],
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
    }, [ready]);

    return <div ref={gameRef} className="rounded-xl overflow-hidden border-4 border-gray-800 shadow-2xl w-full h-full max-w-[1280px] max-h-[720px] mx-auto" />;
}
