import { ArrowLeftRight, GripVertical, Trash2 } from 'lucide-react';
import { TEE_COLORS, TEE_SWATCH } from '../data/courses';
import type { ComboDraft, NineDraft } from '../data/courseDraft';
import { TeeDot } from './TeeDot';

export function ComboEditor({
  combo,
  front,
  back,
  onChange,
  onDelete,
  dragHandleProps,
}: {
  combo: ComboDraft;
  front: NineDraft;
  back: NineDraft;
  onChange: (combo: ComboDraft) => void;
  /** Omit to hide the delete button (e.g. when it's the only combo left). */
  onDelete?: () => void;
  /** Spread onto the drag handle icon — omit to hide it (e.g. when there's only one combo to reorder). */
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const siCounts = new Map<number, number>();
  combo.si.forEach((v) => {
    const n = parseInt(v, 10);
    if (v !== '' && !isNaN(n)) siCounts.set(n, (siCounts.get(n) ?? 0) + 1);
  });

  const updateSi = (idx: number, value: string) => {
    const v = value.replace(/[^0-9]/g, '');
    const si = combo.si.slice();
    si[idx] = v;
    onChange({ ...combo, si });
  };

  const updateRating = (tee: (typeof TEE_COLORS)[number], key: 'rating' | 'slope', value: string) => {
    const cleaned = key === 'slope' ? value.replace(/[^0-9]/g, '') : value.replace(/[^0-9.]/g, '');
    onChange({ ...combo, ratings: { ...combo.ratings, [tee]: { ...combo.ratings[tee], [key]: cleaned } } });
  };

  // Which nine plays holes 1-9 vs 10-18 is auto-derived from nine order when a combo is
  // first created (see deriveCombos) and won't always match how a club actually pairs its
  // nines — swap lets an admin fix just this one combo without reordering every nine.
  const swapOrder = () => {
    const si = [...combo.si.slice(9, 18), ...combo.si.slice(0, 9)];
    const label = combo.label === `${front.name} + ${back.name}` ? `${back.name} + ${front.name}` : combo.label;
    onChange({ ...combo, front: combo.back, back: combo.front, si, label });
  };

  const rows = [
    ...front.holes.map((h, i) => ({ label: i + 1, par: h.par, siIdx: i })),
    ...back.holes.map((h, i) => ({ label: i + 10, par: h.par, siIdx: i + 9 })),
  ];
  const totalPar = rows.reduce((s, r) => s + r.par, 0);

  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, boxShadow: 'var(--shadow-xs)', overflow: 'hidden' }}>
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              title="Drag to reorder — this sets the order kakis see in the app's course picker"
              style={{ display: 'flex', alignItems: 'center', cursor: 'grab', color: 'var(--ink-400)', flexShrink: 0 }}
            >
              <GripVertical size={18} strokeWidth={2} />
            </div>
          )}
          <input
            value={combo.label}
            onChange={(e) => onChange({ ...combo, label: e.target.value })}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ink-900)' }}
          />
          <button
            type="button"
            onClick={swapOrder}
            title="Swap which nine plays holes 1-9 vs 10-18"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 12px',
              border: '1.5px solid var(--border-default)',
              borderRadius: 999,
              background: '#fff',
              color: 'var(--ink-700)',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 12.5,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <ArrowLeftRight size={14} strokeWidth={2} />
            Swap order
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              title="Remove this combo"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                flex: 'none',
                border: 'none',
                borderRadius: '50%',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--ink-400)',
              }}
            >
              <Trash2 size={14} style={{ pointerEvents: 'none' }} />
            </button>
          )}
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
          {front.name} (holes 1–9) then {back.name} (holes 10–18) · stroke index 1–18, no repeats
        </div>
      </div>

      <div style={siRowGrid('var(--sand-50)', '1px solid var(--border-default)', '12px 20px')}>
        <div style={headStyle}>Hole</div>
        <div style={headStyle}>Par</div>
        <div style={headStyle}>Stroke index</div>
      </div>

      {rows.map((r) => {
        const v = parseInt(combo.si[r.siIdx]!, 10);
        const bad = combo.si[r.siIdx] !== '' && (isNaN(v) || v < 1 || v > 18 || (siCounts.get(v) ?? 0) > 1);
        return (
          <div key={r.label} style={siRowGrid('#fff', '1px solid var(--border-subtle)', '8px 20px')}>
            <div style={{ fontFamily: 'var(--font-numeric)', fontWeight: 700, fontSize: 16, color: 'var(--ink-900)' }}>{r.label}</div>
            <div style={{ fontFamily: 'var(--font-numeric)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink-700)' }}>{r.par}</div>
            <input
              inputMode="numeric"
              value={combo.si[r.siIdx]}
              onChange={(e) => updateSi(r.siIdx, e.target.value)}
              placeholder="–"
              style={{
                width: 74,
                height: 38,
                textAlign: 'center',
                border: `1.5px solid ${bad ? 'var(--status-danger)' : 'var(--border-default)'}`,
                borderRadius: 10,
                fontFamily: 'var(--font-numeric)',
                fontSize: 15,
                fontWeight: 600,
                color: bad ? 'var(--status-danger)' : 'var(--ink-900)',
                background: bad ? 'var(--orange-100)' : '#fff',
                outline: 'none',
              }}
            />
          </div>
        );
      })}

      <div style={{ ...siRowGrid('var(--green-50)', 'none', '15px 20px') }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--green-800)' }}>Total</div>
        <div style={{ fontFamily: 'var(--font-numeric)', fontWeight: 700, fontSize: 15, color: 'var(--green-800)' }}>Par {totalPar}</div>
        <div />
      </div>

      <div style={{ padding: '18px 20px 20px' }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-400)', marginBottom: 10 }}>
          Course rating &amp; slope by tee
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {TEE_COLORS.map((tee) => (
            <div key={tee} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink-900)' }}>
                <TeeDot tee={tee} size={13} />
                {TEE_SWATCH[tee].name}
              </div>
              <input
                inputMode="decimal"
                value={combo.ratings[tee]!.rating}
                onChange={(e) => updateRating(tee, 'rating', e.target.value)}
                placeholder="Rating e.g. 72.4"
                style={ratingInputStyle}
              />
              <input
                inputMode="numeric"
                value={combo.ratings[tee]!.slope}
                onChange={(e) => updateRating(tee, 'slope', e.target.value)}
                placeholder="Slope e.g. 131"
                style={ratingInputStyle}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function siRowGrid(background: string, borderBottom: string, padding: string): React.CSSProperties {
  return { display: 'grid', gridTemplateColumns: '56px 80px 1fr', alignItems: 'center', gap: 14, padding, background, borderBottom };
}

const headStyle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-400)' };

const ratingInputStyle: React.CSSProperties = {
  height: 36,
  padding: '0 12px',
  border: '1.5px solid var(--border-default)',
  borderRadius: 9,
  fontFamily: 'var(--font-numeric)',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--ink-900)',
  background: '#fff',
  outline: 'none',
  width: '100%',
};
