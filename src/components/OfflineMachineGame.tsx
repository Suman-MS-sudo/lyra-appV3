'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

// ── Constants ──────────────────────────────────────────────
const COLS = 6;
const ROWS = 7;
const MAX_MOVES = 20;

const GEMS = [
  { bg: 'linear-gradient(145deg,#FF8FB5,#F43F5E)', glow: '#F43F5E', emoji: '🎀', name: 'Blossom' },
  { bg: 'linear-gradient(145deg,#93C5FD,#3B82F6)', glow: '#60A5FA', emoji: '💙', name: 'Bubbles' },
  { bg: 'linear-gradient(145deg,#6EE7B7,#10B981)', glow: '#34D399', emoji: '⚡', name: 'Buttercup' },
  { bg: 'linear-gradient(145deg,#C4B5FD,#7C3AED)', glow: '#A78BFA', emoji: '🔮', name: 'Mojo' },
  { bg: 'linear-gradient(145deg,#FDE68A,#F59E0B)', glow: '#FBBF24', emoji: '👑', name: 'Princess' },
  { bg: 'linear-gradient(145deg,#FCA5A5,#DC2626)', glow: '#EF4444', emoji: '😈', name: 'Him' },
] as const;

// ── Pure game logic ────────────────────────────────────────
const rnd = () => Math.floor(Math.random() * GEMS.length);

function makeGrid(): number[][] {
  const g: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    g[r] = [];
    for (let c = 0; c < COLS; c++) {
      let gem: number;
      do {
        gem = rnd();
      } while (
        (c >= 2 && g[r][c - 1] === gem && g[r][c - 2] === gem) ||
        (r >= 2 && g[r - 1]?.[c] === gem && g[r - 2]?.[c] === gem)
      );
      g[r][c] = gem;
    }
  }
  return g;
}

function findMatches(g: number[][]): Set<string> {
  const m = new Set<string>();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 3; c++) {
      const t = g[r][c];
      if (t < 0) continue;
      let e = c + 1;
      while (e < COLS && g[r][e] === t) e++;
      if (e - c >= 3) for (let i = c; i < e; i++) m.add(`${r},${i}`);
    }
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 3; r++) {
      const t = g[r][c];
      if (t < 0) continue;
      let e = r + 1;
      while (e < ROWS && g[e]?.[c] === t) e++;
      if (e - r >= 3) for (let i = r; i < e; i++) m.add(`${i},${c}`);
    }
  }
  return m;
}

function applyGravity(g: number[][]): { grid: number[][]; newCells: Set<string> } {
  const ng = g.map(row => [...row]);
  const newCells = new Set<string>();
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (ng[r][c] >= 0) {
        ng[write][c] = ng[r][c];
        if (write !== r) ng[r][c] = -1;
        write--;
      }
    }
    for (let r = write; r >= 0; r--) {
      ng[r][c] = rnd();
      newCells.add(`${r},${c}`);
    }
  }
  return { grid: ng, newCells };
}

function hasMoves(g: number[][]): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]] as [number, number][]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= ROWS || nc >= COLS) continue;
        const t = g.map(x => [...x]);
        [t[r][c], t[nr][nc]] = [t[nr][nc], t[r][c]];
        if (findMatches(t).size > 0) return true;
      }
    }
  }
  return false;
}

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

// ── Component ──────────────────────────────────────────────
export function OfflineMachineGame({
  machineName: _machineName,
  onClose,
  inline = false,
}: {
  machineName: string;
  onClose?: () => void;
  inline?: boolean;
}) {
  const [phase, setPhase] = useState<'intro' | 'play' | 'over'>('intro');
  const [grid, setGrid] = useState<number[][]>([]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [newCells, setNewCells] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(MAX_MOVES);
  const [combo, setCombo] = useState(0);
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [shakeCell, setShakeCell] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ r: number; c: number } | null>(null);
  const busyRef = useRef(false);
  const movesRef = useRef(MAX_MOVES);
  const mountedRef = useRef(true);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const gridSnapshotRef = useRef<number[][]>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(hintTimer.current);
    };
  }, []);

  const scheduleHint = useCallback((g: number[][]) => {
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => {
      if (!mountedRef.current) return;
      outer: for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          for (const [dr, dc] of [[0, 1], [1, 0]] as [number, number][]) {
            const nr = r + dr, nc = c + dc;
            if (nr >= ROWS || nc >= COLS) continue;
            const t = g.map(x => [...x]);
            [t[r][c], t[nr][nc]] = [t[nr][nc], t[r][c]];
            if (findMatches(t).size > 0) { setHint([r, c]); break outer; }
          }
        }
      }
    }, 5000);
  }, []);

  const processGrid = useCallback(async (g: number[][], comboCount: number) => {
    if (!mountedRef.current) return;
    const matches = findMatches(g);

    if (matches.size === 0) {
      if (!hasMoves(g)) {
        await sleep(200);
        if (!mountedRef.current) return;
        const fresh = makeGrid();
        setGrid(fresh);
        gridSnapshotRef.current = fresh;
        await sleep(300);
        if (!mountedRef.current) return;
        processGrid(fresh, 0);
        return;
      }
      busyRef.current = false;
      if (movesRef.current <= 0) {
        if (mountedRef.current) setPhase('over');
      } else {
        scheduleHint(g);
      }
      return;
    }

    setMatched(matches);
    setCombo(comboCount);
    const pts = matches.size * 10 * comboCount;
    setScore(s => s + pts);

    await sleep(420);
    if (!mountedRef.current) return;

    const cleared = g.map(row => [...row]);
    matches.forEach(key => {
      const [r, c] = key.split(',').map(Number);
      cleared[r][c] = -1;
    });
    const { grid: fallen, newCells: nc } = applyGravity(cleared);

    setMatched(new Set());
    setNewCells(nc);
    setGrid(fallen);
    gridSnapshotRef.current = fallen;

    await sleep(380);
    if (!mountedRef.current) return;
    setNewCells(new Set());

    processGrid(fallen, comboCount + 1);
  }, [scheduleHint]);

  function startGame() {
    clearTimeout(hintTimer.current);
    const g = makeGrid();
    movesRef.current = MAX_MOVES;
    gridSnapshotRef.current = g;
    setGrid(g);
    setScore(0);
    setMoves(MAX_MOVES);
    setSelected(null);
    setMatched(new Set());
    setNewCells(new Set());
    setCombo(0);
    setHint(null);
    setShakeCell(null);
    busyRef.current = false;
    setPhase('play');
    scheduleHint(g);
  }

  function handleTap(r: number, c: number) {
    if (busyRef.current) return;
    setHint(null);
    clearTimeout(hintTimer.current);
    if (selected) {
      const [sr, sc] = selected;
      if (sr === r && sc === c) { setSelected(null); return; }
      if (Math.abs(r - sr) + Math.abs(c - sc) === 1) {
        setSelected(null);
        doSwap(sr, sc, r, c);
      } else {
        setSelected([r, c]);
      }
    } else {
      setSelected([r, c]);
    }
  }

  async function doSwap(r1: number, c1: number, r2: number, c2: number) {
    if (busyRef.current) return;
    busyRef.current = true;
    clearTimeout(hintTimer.current);

    const snapshot = gridSnapshotRef.current;
    const ng = snapshot.map(row => [...row]);
    [ng[r1][c1], ng[r2][c2]] = [ng[r2][c2], ng[r1][c1]];

    if (findMatches(ng).size === 0) {
      setGrid(ng);
      await sleep(180);
      if (!mountedRef.current) return;
      setGrid(snapshot);
      setShakeCell(`${r1},${c1}`);
      await sleep(380);
      if (!mountedRef.current) return;
      setShakeCell(null);
      busyRef.current = false;
      scheduleHint(snapshot);
      return;
    }

    movesRef.current -= 1;
    setMoves(movesRef.current);
    setGrid(ng);
    gridSnapshotRef.current = ng;
    await sleep(120);
    processGrid(ng, 1);
  }

  const getCellFromPoint = (x: number, y: number): [number, number] | null => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const c = Math.floor(((x - rect.left) / rect.width) * COLS);
    const r = Math.floor(((y - rect.top) / rect.height) * ROWS);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return [r, c];
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const cell = getCellFromPoint(t.clientX, t.clientY);
    if (cell) touchStartRef.current = { r: cell[0], c: cell[1] };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const end = getCellFromPoint(t.clientX, t.clientY);
    const { r: sr, c: sc } = touchStartRef.current;
    touchStartRef.current = null;
    if (!end) return;
    const [er, ec] = end;
    if (er === sr && ec === sc) {
      handleTap(sr, sc);
    } else if (Math.abs(er - sr) + Math.abs(ec - sc) === 1) {
      setSelected(null);
      doSwap(sr, sc, er, ec);
    }
  };

  const gameBg = 'linear-gradient(160deg,#1A0535 0%,#0D0424 55%,#110828 100%)';

  // ── Intro ──────────────────────────────────────────────────
  const introContent = (
    <div className="px-5 pt-5 pb-6 space-y-4">
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#F472B6' }}>Mini Game</p>
        <h3 className="text-xl font-black text-white mb-0.5">Powerpuff Match 3!</h3>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.42)' }}>Match gems · Score big · {MAX_MOVES} moves</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {GEMS.slice(0, 3).map(g => (
          <div key={g.name} className="rounded-xl p-3 text-center" style={{ background: g.bg.replace('linear-gradient(145deg,', 'linear-gradient(145deg,').replace(',#', '18,#').slice(0, -1) + '18)', border: `1px solid ${g.glow}33` }}>
            <div className="text-2xl mb-1">{g.emoji}</div>
            <p className="text-xs font-bold text-white leading-none">{g.name}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {GEMS.slice(3).map(g => (
          <div key={g.name} className="rounded-xl p-3 text-center" style={{ background: `${g.glow}18`, border: `1px solid ${g.glow}33` }}>
            <div className="text-2xl mb-1">{g.emoji}</div>
            <p className="text-xs font-bold text-white leading-none">{g.name}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.50)' }}>
          Tap a gem to select · tap an adjacent gem to swap · match 3 or more in a row!
        </p>
      </div>
      <button
        onClick={startGame}
        className="w-full py-4 rounded-2xl font-black text-white text-base active:scale-95 transition-transform"
        style={{ background: 'linear-gradient(135deg,#F43F5E,#EC4899)', boxShadow: '0 8px 24px rgba(244,63,94,0.40)' }}
      >
        ✨ Let&apos;s Go!
      </button>
    </div>
  );

  // ── Game over ──────────────────────────────────────────────
  const overContent = (
    <div className="flex flex-col items-center justify-center gap-4 py-10 px-6 text-center">
      <p className="text-5xl" style={{ animation: 'ppg-hint 1.5s ease-in-out infinite' }}>🌟</p>
      <div>
        <h3 className="text-xl font-black text-white">Game Over!</h3>
        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>No more moves left</p>
      </div>
      <div className="rounded-2xl px-10 py-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>Final Score</p>
        <p
          className="text-4xl font-black"
          style={{ background: 'linear-gradient(135deg,#F472B6,#A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
        >
          {score.toLocaleString()}
        </p>
      </div>
      <button
        onClick={startGame}
        className="px-8 py-3 rounded-2xl font-black text-white text-sm active:scale-95 transition-transform"
        style={{ background: 'linear-gradient(135deg,#F43F5E,#EC4899)', boxShadow: '0 8px 24px rgba(244,63,94,0.35)' }}
      >
        Play Again 🎀
      </button>
    </div>
  );

  // ── Play ───────────────────────────────────────────────────
  const playContent = (
    <>
      {/* HUD */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Score</p>
          <p className="text-xl font-black leading-none" style={{ color: '#F472B6' }}>{score.toLocaleString()}</p>
        </div>
        {combo > 1 && (
          <div
            className="px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.35)', animation: 'ppg-hint 0.5s ease-in-out 4' }}
          >
            <p className="text-xs font-black" style={{ color: '#FBBF24' }}>✨ {combo}x COMBO!</p>
          </div>
        )}
        <div className="text-right">
          <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Moves</p>
          <p className="text-xl font-black leading-none" style={{ color: moves <= 5 ? '#EF4444' : 'white' }}>{moves}</p>
        </div>
      </div>

      {/* Grid */}
      <div className="p-2.5">
        <div
          ref={gridRef}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gap: '3px',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {grid.map((row, r) =>
            row.map((gem, c) => {
              const key = `${r},${c}`;
              const g = GEMS[gem] ?? GEMS[0];
              const isSel = selected?.[0] === r && selected?.[1] === c;
              const isMatch = matched.has(key);
              const isNew = newCells.has(key);
              const isHint = hint?.[0] === r && hint?.[1] === c;
              const isShake = shakeCell === key;

              let animation: string | undefined;
              if (isMatch) animation = 'ppg-pop 0.42s ease-out forwards';
              else if (isNew) animation = 'ppg-enter 0.38s cubic-bezier(0.34,1.56,0.64,1)';
              else if (isHint) animation = 'ppg-hint 1s ease-in-out infinite';
              else if (isShake) animation = 'ppg-shake 0.38s ease-in-out';

              return (
                <div
                  key={key}
                  onClick={() => handleTap(r, c)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 10,
                    background: g.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'clamp(15px, 4vw, 22px)',
                    cursor: 'pointer',
                    border: `2px solid ${isSel ? g.glow : isHint ? 'rgba(255,255,255,0.6)' : 'transparent'}`,
                    boxShadow: isSel
                      ? `0 0 16px ${g.glow}, inset 0 0 10px rgba(255,255,255,0.25)`
                      : isMatch
                      ? `0 0 22px ${g.glow}`
                      : '0 2px 5px rgba(0,0,0,0.35)',
                    transform: isSel ? 'scale(1.14)' : 'scale(1)',
                    transition: animation ? undefined : 'transform 0.12s, box-shadow 0.12s, border-color 0.12s',
                    animation,
                    willChange: animation ? 'transform, opacity' : undefined,
                  }}
                >
                  {g.emoji}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Moves progress bar */}
      <div className="px-3 pb-3">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            style={{
              height: '100%',
              borderRadius: 9999,
              width: `${(moves / MAX_MOVES) * 100}%`,
              background: moves <= 5 ? 'linear-gradient(90deg,#EF4444,#F43F5E)' : 'linear-gradient(90deg,#F43F5E,#EC4899)',
              transition: 'width 0.3s ease, background 0.3s ease',
            }}
          />
        </div>
      </div>
    </>
  );

  // ── Render ─────────────────────────────────────────────────
  const inner = (
    <div
      className="rounded-2xl overflow-hidden w-full"
      style={{
        background: gameBg,
        border: phase === 'play'
          ? '1px solid rgba(167,139,250,0.25)'
          : '1px solid rgba(244,63,94,0.28)',
      }}
    >
      {/* Close button for non-inline modal on intro/over */}
      {!inline && onClose && phase !== 'play' && (
        <div className="flex justify-end px-4 pt-3">
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.10)' }}
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      )}
      {phase === 'intro' && introContent}
      {phase === 'play' && playContent}
      {phase === 'over' && overContent}
    </div>
  );

  if (!inline) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      >
        <div style={{ width: '100%', maxWidth: 400 }}>
          {phase === 'play' && (
            <div className="flex items-center justify-between px-1 pb-2">
              <p className="text-sm font-black text-white">Powerpuff Match 3</p>
              {onClose && (
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.12)' }}
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              )}
            </div>
          )}
          {inner}
        </div>
      </div>
    );
  }

  return inner;
}
