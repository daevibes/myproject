"use client";

import dynamic from 'next/dynamic';

const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center w-full h-screen bg-[#1a1a1a] text-white">Loading Game...</div>
});

export default function GamePage() {
    return (
        <main className="flex items-center justify-center w-full h-screen bg-black p-4">
            <GameCanvas />
        </main>
    );
}
