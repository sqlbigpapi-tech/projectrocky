'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type GameState = 'ready' | 'swinging' | 'flying' | 'result';

type Target = {
  x: number;       // lateral yards (-50 to +50)
  y: number;       // distance yards
  radius: number;  // yards
  points: number;
  color: string;
  name: string;
  carry: number;   // intended carry distance for this club
};

const TARGETS: Target[] = [
  { name: 'Wedge',  x: 0,   y: 100, radius: 14, points: 50,  color: '#22c55e', carry: 100 },
  { name: '9-iron', x: -28, y: 145, radius: 12, points: 75,  color: '#3b82f6', carry: 145 },
  { name: '7-iron', x: 24,  y: 190, radius: 11, points: 100, color: '#a855f7', carry: 190 },
  { name: '5-iron', x: -18, y: 235, radius: 9,  points: 150, color: '#f59e0b', carry: 235 },
  { name: 'Driver', x: 22,  y: 285, radius: 7,  points: 250, color: '#ef4444', carry: 285 },
];

const RANGE_MAX = 320;
const RANGE_WIDTH = 90;

export default function GolfPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const meterRef = useRef({ pos: 0, dir: 1 });
  const [, forceTick] = useState(0);

  const [state, setState] = useState<GameState>('ready');
  const [club, setClub] = useState(4); // default Driver
  const [ball, setBall] = useState({ x: 0, y: 0 });
  const [landing, setLanding] = useState<{ x: number; y: number } | null>(null);
  const [lastShot, setLastShot] = useState<{ points: number; targetName: string | null; nearest: number; carry: number } | null>(null);

  const [total, setTotal] = useState(0);
  const [balls, setBalls] = useState(0);
  const [best, setBest] = useState(0);
  const [streak, setStreak] = useState(0);

  // Load persisted
  useEffect(() => {
    try {
      const raw = localStorage.getItem('rocky:golf');
      if (raw) {
        const s = JSON.parse(raw);
        setTotal(s.total || 0);
        setBalls(s.balls || 0);
        setBest(s.best || 0);
      }
    } catch {}
  }, []);
  // Persist
  useEffect(() => {
    try {
      localStorage.setItem('rocky:golf', JSON.stringify({ total, balls, best }));
    } catch {}
  }, [total, balls, best]);

  const startSwing = useCallback(() => {
    if (state !== 'ready') return;
    meterRef.current = { pos: 0, dir: 1 };
    setState('swinging');
  }, [state]);

  const stopSwing = useCallback(() => {
    if (state !== 'swinging') return;
    const off = meterRef.current.pos; // -1..1, 0 = perfect
    const absOff = Math.abs(off);
    // Quality: 1 in green zone, drops off
    const quality =
      absOff < 0.08 ? 1.0 :
      absOff < 0.30 ? 1.0 - (absOff - 0.08) * 1.2 :
                      0.74 - (absOff - 0.30) * 0.7;
    const q = Math.max(0.35, Math.min(1.0, quality));
    const target = TARGETS[club];
    // Distance variance: signed by off direction
    const distError = (1 - q) * 70 * (off < 0 ? -1 : 1);
    const lateral = off * 38;
    const carry = Math.max(20, target.carry + distError);
    setLanding({ x: lateral, y: carry });
    setBall({ x: 0, y: 0 });
    setState('flying');
  }, [state, club]);

  const reset = useCallback(() => {
    setState('ready');
    setBall({ x: 0, y: 0 });
    setLanding(null);
    setLastShot(null);
  }, []);

  // Meter animation
  useEffect(() => {
    if (state !== 'swinging') return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      meterRef.current.pos += meterRef.current.dir * dt * 2.4;
      if (meterRef.current.pos > 1)  { meterRef.current.pos = 1;  meterRef.current.dir = -1; }
      if (meterRef.current.pos < -1) { meterRef.current.pos = -1; meterRef.current.dir =  1; }
      forceTick(c => c + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  // Flight animation + scoring
  useEffect(() => {
    if (state !== 'flying' || !landing) return;
    let raf = 0;
    const start = performance.now();
    const dur = 950;
    const land = landing;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 2.2);
      setBall({ x: land.x * e, y: land.y * e });
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        let pts = 0;
        let name: string | null = null;
        let nearest = Infinity;
        TARGETS.forEach(tgt => {
          const dx = land.x - tgt.x;
          const dy = land.y - tgt.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < tgt.radius) {
            const p2 = Math.round(tgt.points * (1 - d / tgt.radius));
            if (p2 > pts) { pts = p2; name = tgt.name; }
          }
          if (d < nearest) nearest = d;
        });
        setLastShot({ points: pts, targetName: name, nearest, carry: land.y });
        setTotal(s => s + pts);
        setBalls(b => b + 1);
        setBest(b => (pts > b ? pts : b));
        setStreak(s => (pts > 0 ? s + 1 : 0));
        setState('result');
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, landing]);

  // Canvas draw — runs after every render
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = c.width;
    const H = c.height;
    ctx.clearRect(0, 0, W, H);

    const teeY = H - 40;
    const horizonY = 30;
    const project = (yx: number, yy: number) => {
      const ty = 1 - yy / RANGE_MAX;
      const py = horizonY + (teeY - horizonY) * ty;
      const widthNear = W * 0.94;
      const widthFar  = W * 0.32;
      const w = widthFar + (widthNear - widthFar) * ty;
      const px = W / 2 + (yx / (RANGE_WIDTH / 2)) * (w / 2);
      return { x: px, y: py };
    };

    // grass
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a1f12');
    bg.addColorStop(0.5, '#143524');
    bg.addColorStop(1, '#1f4d33');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // sky strip
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
    sky.addColorStop(0, '#1e293b');
    sky.addColorStop(1, 'rgba(10, 31, 18, 0)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizonY + 40);

    // distance grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    for (let d = 50; d <= 300; d += 50) {
      const left  = project(-RANGE_WIDTH / 2, d);
      const right = project( RANGE_WIDTH / 2, d);
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillText(`${d}y`, right.x + 4, right.y + 3);
    }

    // center line
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    const top = project(0, RANGE_MAX);
    const bot = project(0, 0);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bot.x, bot.y);
    ctx.stroke();

    // targets
    TARGETS.forEach((t, i) => {
      const c0 = project(t.x, t.y);
      const c1 = project(t.x + t.radius, t.y);
      const r  = Math.abs(c1.x - c0.x);
      const isSelected = i === club;

      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      ctx.arc(c0.x, c0.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = t.color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.beginPath();
      ctx.arc(c0.x, c0.y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c0.x, c0.y, r * 0.6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(c0.x, c0.y, r * 0.18, 0, Math.PI * 2);
      ctx.fill();

      // points label
      ctx.fillStyle = isSelected ? '#fbbf24' : 'rgba(255,255,255,0.85)';
      ctx.font = `bold ${isSelected ? 11 : 9}px ui-monospace, SFMono-Regular, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`${t.points}`, c0.x, c0.y - r - 5);
      ctx.textAlign = 'left';

      if (isSelected) {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(c0.x, c0.y, r + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // tee
    const tee = project(0, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(tee.x - 14, tee.y, 28, 4);

    // ball
    const bp = project(ball.x, ball.y);
    let r = 3.5;
    if (state === 'flying' && landing) {
      const prog = ball.y / Math.max(1, landing.y);
      r = 3.5 + Math.sin(prog * Math.PI) * 7;
      // shadow under flying ball
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.arc(bp.x + r * 0.55, bp.y + r * 0.55, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255,255,255,0.6)';
    ctx.shadowBlur = state === 'flying' ? 8 : 0;
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // landing marker
    if (state === 'result' && landing) {
      const lp = project(landing.x, landing.y);
      const hit = lastShot && lastShot.points > 0;
      ctx.strokeStyle = hit ? '#fbbf24' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, 19, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  // resize
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const resize = () => {
      const parent = c.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = Math.min(560, Math.max(380, w * 0.65));
      c.width = w;
      c.height = h;
      forceTick(t => t + 1);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const handleAction = useCallback(() => {
    if (state === 'ready')         startSwing();
    else if (state === 'swinging') stopSwing();
    else if (state === 'result')   reset();
  }, [state, startSwing, stopSwing, reset]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleAction();
      } else if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= TARGETS.length && state === 'ready') {
          setClub(n - 1);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleAction, state]);

  const meterPos = meterRef.current.pos;
  const buttonLabel =
    state === 'ready'    ? 'SWING' :
    state === 'swinging' ? 'STOP'  :
    state === 'flying'   ? '...'   : 'NEXT BALL';

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-3xl mx-auto p-5 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <a href="/" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition">← Rocky</a>
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
            Driving Range
          </h1>
          <div className="w-12 text-right">
            {streak > 1 && (
              <span className="text-[10px] font-mono font-bold text-amber-400 tabular-nums">
                🔥 {streak}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl bg-[var(--card)] border border-[var(--border)]/40 p-3 text-center">
            <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">Total</div>
            <div className="text-xl font-bold font-mono tabular-nums text-amber-400">{total.toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-[var(--card)] border border-[var(--border)]/40 p-3 text-center">
            <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">Balls</div>
            <div className="text-xl font-bold font-mono tabular-nums text-zinc-300">{balls}</div>
          </div>
          <div className="rounded-xl bg-[var(--card)] border border-[var(--border)]/40 p-3 text-center">
            <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">Best Shot</div>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-400">{best}</div>
          </div>
        </div>

        {/* Club selector */}
        <div className="grid grid-cols-5 gap-2 mb-3">
          {TARGETS.map((t, i) => {
            const sel = i === club;
            return (
              <button
                key={t.name}
                onClick={() => state === 'ready' && setClub(i)}
                disabled={state !== 'ready'}
                className={`px-2 py-2 rounded-lg text-[11px] font-mono font-bold tracking-widest transition-all duration-150 border ${
                  sel
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
                    : 'bg-[var(--card)] text-zinc-500 border-[var(--border)]/40 hover:text-zinc-300 disabled:opacity-50'
                }`}
                style={{ borderTopColor: sel ? t.color : undefined }}
              >
                <div className="truncate">{t.name.toUpperCase()}</div>
                <div className="text-[9px] text-zinc-600 font-normal mt-0.5">{t.carry}y · {t.points}</div>
              </button>
            );
          })}
        </div>

        {/* Range canvas */}
        <div className="rounded-xl overflow-hidden border border-[var(--border)]/40 bg-black/30 mb-3">
          <canvas
            ref={canvasRef}
            onClick={handleAction}
            className="block w-full cursor-pointer select-none"
          />
        </div>

        {/* Result */}
        {state === 'result' && lastShot && (
          <div className={`rounded-xl border p-3 mb-3 text-center ${
            lastShot.points >= 200 ? 'border-red-500/40 bg-red-500/10' :
            lastShot.points >= 100 ? 'border-amber-500/40 bg-amber-500/10' :
            lastShot.points > 0    ? 'border-emerald-500/40 bg-emerald-500/10' :
                                     'border-zinc-700 bg-zinc-900/30'
          }`}>
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              Carry <span className="text-zinc-300 normal-case">{Math.round(lastShot.carry)}y</span>
              {lastShot.points === 0 && <> · {Math.round(lastShot.nearest)}y from nearest</>}
            </div>
            {lastShot.points > 0 ? (
              <div className="mt-1">
                <span className="text-2xl font-bold font-mono tabular-nums text-white">+{lastShot.points}</span>
                {lastShot.targetName && <span className="ml-2 text-sm font-mono text-zinc-400">{lastShot.targetName}</span>}
              </div>
            ) : (
              <div className="mt-1 text-sm font-mono text-zinc-500">Missed the targets</div>
            )}
          </div>
        )}

        {/* Meter */}
        {(state === 'swinging' || state === 'flying' || state === 'result') && (
          <div className="rounded-xl border border-[var(--border)]/40 bg-[var(--card)] p-3 mb-3">
            <div className="relative h-6 rounded-full bg-black/50 overflow-hidden">
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[8%] bg-emerald-500/30 border-x border-emerald-500/60" />
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[30%] bg-emerald-500/5" />
              <div
                className="absolute top-0 bottom-0 w-1 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]"
                style={{ left: `calc(50% + ${meterPos * 50}% - 2px)` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
              <span>← Pull</span>
              <span className="text-emerald-500">Sweet Spot</span>
              <span>Push →</span>
            </div>
          </div>
        )}

        {/* Action button */}
        <button
          onClick={handleAction}
          disabled={state === 'flying'}
          className={`w-full py-4 rounded-xl font-bold font-mono tracking-widest transition-all duration-150 ${
            state === 'ready'    ? 'bg-emerald-500 text-black hover:bg-emerald-400 active:scale-[0.99]' :
            state === 'swinging' ? 'bg-amber-500 text-black hover:bg-amber-400 active:scale-[0.99] animate-pulse' :
            state === 'flying'   ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' :
                                   'bg-zinc-700 text-zinc-100 hover:bg-zinc-600 active:scale-[0.99]'
          }`}
        >
          {buttonLabel}
        </button>

        <div className="text-center text-[10px] font-mono text-zinc-600 mt-3 tracking-widest">
          SPACE / TAP · 1–5 to switch clubs · stop in the green zone for a flush strike
        </div>
      </div>
    </main>
  );
}
