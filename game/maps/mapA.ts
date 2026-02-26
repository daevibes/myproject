import { MapData } from '../config/constants';

export const mapA: MapData = {
    name: 'Map A: River Crossing',
    backgroundColor: 0x2d2d2d,
    princess: { x: 1200, y: 800 },
    playerSpawn: { x: 1200, y: 850 },
    obstacles: [
        { x: 500, y: 1600, w: 1000, h: 200, color: 0x2244aa, type: 'block' },
        { x: 1900, y: 1600, w: 1000, h: 200, color: 0x2244aa, type: 'block' },
    ],
    zones: [
        { x: 1200, y: 1600, w: 400, h: 200, color: 0x8B4513, type: 'zone' },
    ],
    spawnPoints: [
        { x: 200, y: 200 },
        { x: 2200, y: 200 },
        { x: 200, y: 3000 },
        { x: 2200, y: 3000 },
    ],
};
