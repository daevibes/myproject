---
name: Phaser 3 + Next.js Bridge
description: Next.js App Router에 Phaser 게임을 안전하게 마운트/언마운트하는 패턴
---

# Phaser 3 + Next.js Bridge

## 핵심 원칙
- Phaser는 **브라우저 전용**이므로 반드시 `"use client"` + `typeof window !== 'undefined'` 체크
- `useEffect` cleanup에서 반드시 `game.destroy(true)` 호출 → 메모리 누수 방지
- `useRef`로 컨테이너 div를 참조하여 Phaser가 해당 DOM에 캔버스를 렌더링

## GameCanvas 컴포넌트

```typescript
// components/game/GameCanvas.tsx
"use client";

import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { BootScene } from '@/game/scenes/BootScene';
import { MainScene } from '@/game/scenes/MainScene';

export default function GameCanvas() {
  const gameRef = useRef<HTMLDivElement>(null);
  const gameInstance = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    // SSR 방지: 브라우저 환경에서만 실행
    if (typeof window === 'undefined' || !gameRef.current) return;

    // 이미 게임 인스턴스가 있으면 중복 생성 방지
    if (gameInstance.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: gameRef.current,
      width: 800,
      height: 600,
      backgroundColor: '#1a1a2e',
      scene: [BootScene, MainScene],
      physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 0 }, debug: false },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    gameInstance.current = new Phaser.Game(config);

    // Cleanup: 컴포넌트 언마운트 시 게임 파괴
    return () => {
      if (gameInstance.current) {
        gameInstance.current.destroy(true);
        gameInstance.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={gameRef}
      className="rounded-xl overflow-hidden border-4 border-gray-800 shadow-2xl"
    />
  );
}
```

## Next.js 페이지에서 사용

```typescript
// app/game/page.tsx
import GameCanvas from '@/components/game/GameCanvas';

export default function GamePage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <GameCanvas />
    </div>
  );
}
```

## React StrictMode 대응
React 18의 StrictMode는 개발 환경에서 `useEffect`를 **2번 실행**합니다.
`gameInstance.current` 체크로 중복 생성을 방지하고 있으므로 문제 없이 동작합니다.

## 주의사항
- Phaser의 `parent` 옵션에 DOM 요소를 직접 전달 (`ref.current`)
- `game.destroy(true)`의 `true`는 캔버스 DOM까지 제거한다는 의미
- Next.js의 페이지 이동(라우팅) 시 cleanup이 자동 실행되어 게임이 정상 해제됨
- `scale.mode: FIT`를 사용하면 부모 div 크기에 맞게 자동 리사이즈
