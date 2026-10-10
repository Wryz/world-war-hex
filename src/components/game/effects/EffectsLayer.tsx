import React, { useEffect, useMemo, useState } from 'react';
import { CoinBurst, MATERIAL_FLIGHT_MS, MaterialFlight, MomentTone, useEffects } from './effects';
import { CoinIcon, GoldIcon, SatchelIcon } from '../icons';
import { MaterialIcon } from '../MaterialIcon';

// HUD overlay for the battle's big moments: callouts, coins flying to the treasury, confetti and
// a red flash when your castle is hit

const TONE_COLORS: Record<MomentTone, { text: string; glow: string }> = {
  gold: { text: '#fcd34d', glow: 'rgba(245, 158, 11, 0.55)' },
  red: { text: '#fca5a5', glow: 'rgba(239, 68, 68, 0.55)' },
  blue: { text: '#93c5fd', glow: 'rgba(59, 130, 246, 0.55)' },
  purple: { text: '#d8b4fe', glow: 'rgba(168, 85, 247, 0.55)' },
  green: { text: '#86efac', glow: 'rgba(34, 197, 94, 0.55)' }
};

// Where coins fly to: the gold counter in the battle HUD, or the coin counter on the results screen
// (whichever gold counter is showing: the top bar's, or the one beside the hand on a phone)
const targetPoint = (target: CoinBurst['target']) => {
  const ids = target === 'gold' ? ['hud-gold', 'hud-gold-phone'] : ['hud-coins'];
  const rect = ids.map(id => document.getElementById(id)?.getBoundingClientRect()).find(box => box && box.width > 0);
  if (!rect) return { x: window.innerWidth - 80, y: 30 };
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

const CoinFlight: React.FC<{ burst: CoinBurst }> = ({ burst }) => {
  const [to] = useState(() => targetPoint(burst.target));
  // Each coin pops out in a slightly different direction, then streams to the counter
  const coins = useMemo(() => Array.from({ length: burst.count }, (_, i) => ({
    delay: i * 0.05,
    spreadX: Math.cos(i * 2.4) * (30 + (i % 3) * 14),
    spreadY: -30 - ((i * 37) % 40)
  })), [burst.count]);

  return (
    <>
      {coins.map((coin, i) => (
        <span
          key={i}
          className="coin-flight pointer-events-none fixed left-0 top-0 z-[60] text-xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]"
          style={{
            '--from-x': `${burst.from.x}px`,
            '--from-y': `${burst.from.y}px`,
            '--mid-x': `${burst.from.x + coin.spreadX}px`,
            '--mid-y': `${burst.from.y + coin.spreadY}px`,
            '--to-x': `${to.x}px`,
            '--to-y': `${to.y}px`,
            animationDelay: `${coin.delay}s`
          } as React.CSSProperties}
        >
          {burst.target === 'gold' ? <GoldIcon /> : <CoinIcon />}
        </span>
      ))}
    </>
  );
};

// Where found materials fly to: the satchel that pops up below the round counter while they do
// (clear of a phone's notch and rounded corners, like the counter itself)
const SATCHEL_POINT = { x: 'calc(40px + var(--safe-l, 0px))', y: 'calc(92px + var(--safe-t, 0px))' };
const offset = (point: string, by: number) => `calc(${point} - ${by}px)`;

const MaterialFlightView: React.FC<{ flight: MaterialFlight }> = ({ flight }) => (
  <span
    className="material-flight pointer-events-none fixed left-0 top-0 z-[60] flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/85 text-2xl shadow-lg ring-1 ring-white/30"
    style={{
      '--from-x': `${flight.from.x - 18}px`,
      '--from-y': `${flight.from.y - 18}px`,
      '--mid-x': `${flight.from.x - 18}px`,
      '--mid-y': `${flight.from.y - 70}px`,
      '--to-x': offset(SATCHEL_POINT.x, 18),
      '--to-y': offset(SATCHEL_POINT.y, 18),
      animationDelay: `${flight.delay}s`
    } as React.CSSProperties}
  >
    <MaterialIcon id={flight.material} />
  </span>
);

// The satchel itself, there just long enough to catch what flies into it
const SatchelCatch: React.FC<{ id: number; delay: number }> = ({ id, delay }) => (
  <span
    key={id}
    className="satchel-catch pointer-events-none fixed z-[59] flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900/90 text-3xl shadow-lg ring-2 ring-amber-300/70"
    style={{
      left: offset(SATCHEL_POINT.x, 24),
      top: offset(SATCHEL_POINT.y, 24),
      animationDuration: `${MATERIAL_FLIGHT_MS / 1000 + delay}s`
    }}
    aria-hidden
  >
    <SatchelIcon />
  </span>
);

const CONFETTI_COLORS = ['#fbbf24', '#f87171', '#60a5fa', '#34d399', '#c084fc', '#f472b6', '#ffffff'];

const Confetti: React.FC = () => {
  const pieces = useMemo(() => Array.from({ length: 90 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: ((i * 13) % 20) / 40,
    duration: 2 + ((i * 7) % 10) / 8,
    drift: ((i * 53) % 120) - 60,
    rotate: (i * 47) % 360,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    wide: i % 3 === 0
  })), []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[55] overflow-hidden" aria-hidden>
      {pieces.map((piece, i) => (
        <span
          key={i}
          className="confetti-piece absolute top-0 block"
          style={{
            left: `${piece.left}%`,
            width: piece.wide ? 12 : 7,
            height: piece.wide ? 6 : 12,
            background: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            '--drift': `${piece.drift}px`,
            '--spin': `${piece.rotate + 720}deg`
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

const DamageFlash: React.FC<{ count: number }> = ({ count }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (count === 0) return;
    setVisible(true);
    const timeout = setTimeout(() => setVisible(false), 450);
    return () => clearTimeout(timeout);
  }, [count]);
  if (!visible) return null;
  return <div key={count} className="damage-flash pointer-events-none fixed inset-0 z-[54]" aria-hidden />;
};

export const EffectsLayer: React.FC = () => {
  const { coins, materials, moments, confetti, flash } = useEffects();
  // (the satchel stays for the last of the flights in the air)
  const lastFlight = materials[materials.length - 1];

  return (
    <>
      <DamageFlash count={flash} />
      {confetti.map(id => <Confetti key={id} />)}
      {coins.map(burst => <CoinFlight key={burst.id} burst={burst} />)}
      {lastFlight && <SatchelCatch key={lastFlight.id} id={lastFlight.id} delay={Math.max(...materials.map(flight => flight.delay))} />}
      {materials.map(flight => <MaterialFlightView key={flight.id} flight={flight} />)}

      <div className="pointer-events-none fixed inset-x-0 top-[22%] z-[56] flex flex-col items-center gap-2" role="status" aria-live="polite">
        {moments.map(moment => {
          const tone = TONE_COLORS[moment.tone];
          return (
            <div key={moment.id} className={`moment-pop flex flex-col items-center ${moment.big ? 'moment-big' : ''}`}>
              <div
                className={`font-display text-center leading-none ${moment.big ? 'text-6xl sm:text-8xl' : 'text-4xl sm:text-5xl'}`}
                style={{
                  color: tone.text,
                  WebkitTextStroke: moment.big ? '3px #0f172a' : '2px #0f172a',
                  paintOrder: 'stroke fill',
                  textShadow: `0 5px 0 #0f172a, 0 0 32px ${tone.glow}`
                }}
              >
                {moment.title}
              </div>
              {/* Only huge moments and new rules explain themselves; the rest are just their title */}
              {(moment.big || moment.explain) && moment.subtitle && (
                <div className="mt-2 rounded-full bg-slate-900/80 px-4 py-1 text-sm font-bold text-slate-100 shadow-lg">
                  {moment.subtitle}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};
