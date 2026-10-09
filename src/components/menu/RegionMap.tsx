import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LevelDef } from '@/lib/campaign/levels';
import { MAP_COLS, MAP_ROWS, MAP_SHEET_URL, SHEET_TILE, RegionMap as RegionMapData, buildRegionMap } from '@/lib/campaign/mapArt';
import { BossIcon, FilledStarIcon, LockIcon, MedalIcon, ShieldIcon, StarIcon } from '../game/icons';

// The map art, loaded once for every region
let sheet: Promise<HTMLImageElement> | null = null;
const loadSheet = () => {
  sheet ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = MAP_SHEET_URL;
  });
  return sheet;
};

// Widest the island is drawn, in CSS pixels
const MAX_WIDTH = 640;

const drawRegion = (canvas: HTMLCanvasElement, image: HTMLImageElement, map: RegionMapData) => {
  const cell = canvas.width / MAP_COLS;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  // Tinted layers are drawn on their own so the wash only covers their tiles
  const layer = document.createElement('canvas');
  layer.width = canvas.width;
  layer.height = canvas.height;
  const layerContext = layer.getContext('2d')!;
  for (const { sprites, tint } of map.layers) {
    const target = tint ? layerContext : context;
    if (tint) layerContext.clearRect(0, 0, layer.width, layer.height);
    for (const { tile: [row, col], col: x, row: y, scale, dx, dy } of sprites) {
      const size = cell * scale;
      // Round to whole pixels (one pixel over) so neighbouring tiles meet without seams
      const left = Math.floor((x + dx) * cell + (cell - size) / 2);
      const top = Math.floor((y + dy) * cell + (cell - size) / 2);
      target.drawImage(image, col * SHEET_TILE, row * SHEET_TILE, SHEET_TILE, SHEET_TILE, left, top, Math.ceil(size) + 1, Math.ceil(size) + 1);
    }
    if (tint) {
      layerContext.globalCompositeOperation = 'source-atop';
      layerContext.fillStyle = tint;
      layerContext.fillRect(0, 0, layer.width, layer.height);
      layerContext.globalCompositeOperation = 'source-over';
      context.drawImage(layer, 0, 0);
    }
  }
};

const LevelNode: React.FC<{
  level: LevelDef;
  stars: number;
  // Its challenge has been met
  medal?: boolean;
  unlocked: boolean;
  isNext: boolean;
  onSelect: () => void;
}> = ({ level, stars, medal, unlocked, isNext, onSelect }) => {
  const diamond = !unlocked ? '#94a3b8' : level.isBoss ? '#ef4444' : stars > 0 ? '#f59e0b' : level.isElite ? '#8b5cf6' : '#2ecc71';
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!unlocked}
      data-level={level.id}
      title={unlocked ? `${level.id}. ${level.name}` : 'Locked'}
      aria-label={unlocked ? `Level ${level.id}: ${level.name}` : `Level ${level.id} (locked)`}
      className={`group flex h-full w-full flex-col items-center justify-center focus:outline-none ${unlocked ? 'cursor-pointer' : 'cursor-not-allowed'}`}
    >
      <span
        className={`relative flex aspect-square items-center justify-center rounded-[18%] transition-transform ${level.isBoss ? 'w-[92%]' : 'w-[78%]'} ${unlocked ? 'group-hover:scale-110 group-focus-visible:scale-110' : ''} ${isNext ? 'node-pulse' : ''}`}
        style={{
          background: unlocked ? '#ffffff' : '#e2e8f0',
          border: isNext ? '3px solid #facc15' : '3px solid #1e293b',
          boxShadow: '0 4px 0 rgba(15,23,42,0.45)'
        }}
      >
        <span className="absolute h-[62%] w-[62%] rotate-45 rounded-[14%]" style={{ background: diamond, boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.18)' }} />
        <span className="font-display relative text-[clamp(10px,2.6vw,17px)] leading-none text-white" style={{ textShadow: '0 1px 0 rgba(15,23,42,0.6)' }}>
          {!unlocked ? <LockIcon color="#ffffff" /> : level.isBoss ? <BossIcon color="#fff" /> : level.id}
        </span>
        {level.isElite && unlocked && <ShieldIcon className="absolute -right-2 -top-2 text-sm" color="#a78bfa" />}
        {medal && <MedalIcon className="absolute -left-2 -top-2 text-sm drop-shadow-[0_1px_0_#0f172a]" />}
      </span>
      {unlocked && (
        <span className="mt-0.5 flex gap-px rounded-full bg-slate-900/75 px-1 py-px">
          {[0, 1, 2].map(i => i < stars
            ? <FilledStarIcon key={i} className="text-[0.5625rem] sm:text-[0.6875rem]" />
            : <StarIcon key={i} className="text-[0.5625rem] sm:text-[0.6875rem]" color="#64748b" />)}
        </span>
      )}
    </button>
  );
};

// One region of the campaign as an island of map tiles, with its ten levels along the road
export const RegionMap: React.FC<{
  regionId: number;
  levels: LevelDef[];
  starsFor: (level: LevelDef) => number;
  // Whether a level's challenge has been met
  medalFor?: (level: LevelDef) => boolean;
  unlockedUpTo: number;
  isNext: (level: LevelDef) => boolean;
  locked: boolean;
  lockedLabel?: React.ReactNode;
  onSelect: (level: LevelDef) => void;
}> = ({ regionId, levels, starsFor, medalFor, unlockedUpTo, isNext, locked, lockedLabel, onSelect }) => {
  const map = useMemo(() => buildRegionMap(regionId), [regionId]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  // Draw at the island's on-screen size, sharp on high-density screens
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const cell = Math.round(width * scale / MAP_COLS);
    canvas.width = cell * MAP_COLS;
    canvas.height = cell * MAP_ROWS;
    let cancelled = false;
    loadSheet().then(image => {
      if (!cancelled) drawRegion(canvas, image, map);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [map, width]);

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: MAX_WIDTH, aspectRatio: `${MAP_COLS} / ${MAP_ROWS}` }}>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
        style={locked ? { filter: 'grayscale(0.85) brightness(0.85)' } : undefined}
      />
      {levels.map((level, index) => {
        const node = map.nodes[index];
        return (
          <div
            key={level.id}
            className="absolute"
            style={{
              left: `${node.col / MAP_COLS * 100}%`,
              top: `${node.row / MAP_ROWS * 100}%`,
              width: `${100 / MAP_COLS}%`,
              height: `${100 / MAP_ROWS}%`
            }}
          >
            <LevelNode
              level={level}
              stars={starsFor(level)}
              medal={medalFor?.(level)}
              unlocked={level.id <= unlockedUpTo}
              isNext={isNext(level)}
              onSelect={() => onSelect(level)}
            />
          </div>
        );
      })}
      {locked && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl"
          style={{ background: 'rgba(226,232,240,0.55)' }}>
          {lockedLabel}
        </div>
      )}
    </div>
  );
};
