import { TEE_COLORS, TEE_SWATCH } from '../data/courses';
import type { ComboDraft, NineDraft } from '../data/courseDraft';
import { TeeDot } from './TeeDot';

export function ComboEditor({
  combo,
  front,
  back,
  onChange,
}: {
  combo: ComboDraft;
  front: NineDraft;
  back: NineDraft;
  onChange: (combo: ComboDraft) => void;
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

  const rows = [
    ...front.holes.map((h, i) => ({ label: i + 1, par: h.par, siIdx: i })),
    ...back.holes.map((h, i) => ({ label: i + 10, par: h.par, siIdx: i + 9 })),
  ];
  const totalPar = rows.reduce((s, r) => s + r.par, 0);

  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, boxShadow: 'var(--shadow-xs)', overflow: 'hidden' }}>
      <div style={{ padding: '20px 20px 16px' }}>
        <input
          value={combo.label}
          onChange={(e) => onChange({ ...combo, label: e.target.value })}
          style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ink-900)', width: '100%' }}
        />
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
