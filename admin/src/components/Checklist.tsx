import { Check, Minus } from 'lucide-react';

export type CheckItem = { label: string; ok: boolean };

export function Checklist({ items }: { items: CheckItem[] }) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xs)',
        padding: '18px 18px 20px',
      }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--ink-900)', marginBottom: 14 }}>
        Before you publish
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {items.map((c) => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: c.ok ? 'var(--green-100)' : 'var(--sand-200)',
                color: c.ok ? 'var(--green-700)' : 'var(--ink-400)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
              }}
            >
              {c.ok ? <Check size={13} /> : <Minus size={13} />}
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: c.ok ? 'var(--ink-900)' : 'var(--ink-500)' }}>
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
