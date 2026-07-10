import { useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { TEE_COLORS, TEE_SWATCH, type TeeColor } from '../data/courses';
import { newNine, type NineDraft } from '../data/courseDraft';
import { TeeDot } from './TeeDot';

const parOptions: (3 | 4 | 5)[] = [3, 4, 5];

export function NineEditor({
  nines,
  activeNine,
  onSelectNine,
  onChange,
}: {
  nines: NineDraft[];
  activeNine: number;
  onSelectNine: (i: number) => void;
  onChange: (nines: NineDraft[]) => void;
}) {
  const active = nines[activeNine];
  const [distanceTee, setDistanceTee] = useState<TeeColor>('blue');
  const yardageRefs = useRef<Array<HTMLInputElement | null>>([]);

  if (!active) return null;

  const updateHole = (holeIdx: number, patch: Partial<NineDraft['holes'][number]>) => {
    const holes = active.holes.slice();
    holes[holeIdx] = { ...holes[holeIdx]!, ...patch };
    const next = nines.slice();
    next[activeNine] = { ...active, holes };
    onChange(next);
  };

  const updateYardage = (holeIdx: number, tee: TeeColor, value: string) => {
    const v = value.replace(/[^0-9]/g, '');
    const yardage = { ...active.holes[holeIdx]!.yardage, [tee]: v };
    updateHole(holeIdx, { yardage });
  };

  const renameNine = (name: string) => {
    const next = nines.slice();
    next[activeNine] = { ...active, name };
    onChange(next);
  };

  const addNine = () => {
    const next = [...nines, newNine(`Nine ${nines.length + 1}`)];
    onChange(next);
    onSelectNine(next.length - 1);
  };

  const removeNine = (i: number) => {
    if (nines.length <= 1) return;
    const next = nines.filter((_, k) => k !== i);
    onChange(next);
    onSelectNine(Math.min(activeNine, next.length - 1));
  };

  const totalPar = active.holes.reduce((s, h) => s + h.par, 0);
  const totalDist = active.holes.reduce((s, h) => s + (parseInt(h.yardage[distanceTee], 10) || 0), 0);

  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, boxShadow: 'var(--shadow-xs)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '20px 20px 16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ink-900)' }}>Nines</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
            Each nine holds par + distances by tee. Add a second nine so kakis can play 18.
          </div>
        </div>
        <button onClick={addNine} style={addBtnStyle}>
          <Plus size={15} />
          Add nine
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px 16px', flexWrap: 'wrap' }}>
        {nines.map((n, i) => {
          const selected = i === activeNine;
          return (
            <div
              key={n.id}
              onClick={() => onSelectNine(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 36,
                padding: '0 8px 0 14px',
                borderRadius: 999,
                cursor: 'pointer',
                background: selected ? 'var(--green-50)' : '#fff',
                border: selected ? '1.5px solid var(--green-200)' : '1.5px solid var(--border-default)',
              }}
            >
              <input
                value={n.name}
                onFocus={() => onSelectNine(i)}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => renameNine(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink-900)', width: Math.max(60, n.name.length * 8) }}
              />
              <button
                type="button"
                className="gk-nine-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (nines.length <= 1) return;
                  if (window.confirm(`Delete "${n.name}"? This removes its hole data and any combo that pairs it with another nine.`)) {
                    removeNine(i);
                  }
                }}
                disabled={nines.length <= 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 30,
                  height: 30,
                  flex: 'none',
                  border: 'none',
                  borderRadius: '50%',
                  background: 'transparent',
                  cursor: nines.length > 1 ? 'pointer' : 'not-allowed',
                  opacity: nines.length > 1 ? 1 : 0.35,
                  color: 'var(--ink-400)',
                }}
              >
                <Trash2 size={14} style={{ pointerEvents: 'none' }} />
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '0 20px 14px' }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--ink-500)' }}>Distances:</span>
        <div style={{ display: 'inline-flex', background: 'var(--sand-100)', border: '1px solid var(--border-subtle)', borderRadius: 999, padding: 3, gap: 2 }}>
          {TEE_COLORS.map((tee) => {
            const selected = tee === distanceTee;
            return (
              <button
                key={tee}
                onClick={() => setDistanceTee(tee)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 30,
                  padding: '0 12px',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 999,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: 12.5,
                  background: selected ? '#fff' : 'transparent',
                  color: selected ? 'var(--ink-900)' : 'var(--ink-500)',
                  boxShadow: selected ? 'var(--shadow-xs)' : 'none',
                }}
              >
                <TeeDot tee={tee} size={11} />
                {TEE_SWATCH[tee].name}
              </button>
            );
          })}
        </div>
      </div>

      <div style={rowGrid('var(--sand-50)', '1px solid var(--border-default)', '12px 20px')}>
        <div style={headStyle}>Hole</div>
        <div style={headStyle}>Par</div>
        <div style={{ ...headStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
          <TeeDot tee={distanceTee} size={11} />
          {TEE_SWATCH[distanceTee].name} (m)
        </div>
      </div>

      {active.holes.map((h, i) => (
        <div key={i} style={rowGrid('#fff', '1px solid var(--border-subtle)', '8px 20px')}>
          <div style={{ fontFamily: 'var(--font-numeric)', fontWeight: 700, fontSize: 16, color: 'var(--ink-900)' }}>{i + 1}</div>
          <div style={{ display: 'inline-flex', border: '1.5px solid var(--border-default)', borderRadius: 999, overflow: 'hidden', background: '#fff', width: 'max-content' }}>
            {parOptions.map((p, k) => (
              <button
                key={p}
                onClick={() => updateHole(i, { par: p })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 46,
                  height: 36,
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-numeric)',
                  fontWeight: 600,
                  fontSize: 15,
                  background: h.par === p ? 'var(--green-800)' : '#fff',
                  color: h.par === p ? '#fff' : 'var(--ink-400)',
                  borderLeft: k > 0 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            ref={(el) => {
              yardageRefs.current[i] = el;
            }}
            inputMode="numeric"
            value={h.yardage[distanceTee]}
            onChange={(e) => updateYardage(i, distanceTee, e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Tab') return;
              const next = yardageRefs.current[e.shiftKey ? i - 1 : i + 1];
              if (next) {
                e.preventDefault();
                next.focus();
              }
            }}
            placeholder="add meters"
            style={{ width: 118, height: 38, padding: '0 13px', border: '1.5px solid var(--border-default)', borderRadius: 10, fontFamily: 'var(--font-numeric)', fontSize: 15, fontWeight: 600, color: 'var(--ink-900)', background: '#fff', outline: 'none' }}
          />
        </div>
      ))}

      <div style={{ ...rowGrid('var(--green-50)', 'none', '15px 20px') }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--green-800)' }}>Total</div>
        <div style={{ fontFamily: 'var(--font-numeric)', fontWeight: 700, fontSize: 15, color: 'var(--green-800)' }}>Par {totalPar}</div>
        <div style={{ fontFamily: 'var(--font-numeric)', fontWeight: 700, fontSize: 15, color: 'var(--green-800)' }}>{totalDist.toLocaleString('en-US')} m</div>
      </div>
    </div>
  );
}

function rowGrid(background: string, borderBottom: string, padding: string): React.CSSProperties {
  return { display: 'grid', gridTemplateColumns: '56px 168px 1fr', alignItems: 'center', gap: 14, padding, background, borderBottom };
}

const headStyle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-400)' };

const addBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 36,
  padding: '0 14px',
  border: '1.5px solid var(--border-default)',
  background: '#fff',
  cursor: 'pointer',
  borderRadius: 999,
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  fontSize: 13,
  color: 'var(--green-800)',
  flex: 'none',
};
