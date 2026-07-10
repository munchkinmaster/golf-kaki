import type { LucideIcon } from 'lucide-react';

export function StatCard({ label, value, icon: Icon, bg, fg }: { label: string; value: number | string; icon: LucideIcon; bg: string; fg: string }) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xs)',
        padding: '16px 18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: bg,
            color: fg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <Icon size={16} strokeWidth={2} />
        </span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-numeric)', fontWeight: 700, fontSize: 26, color: 'var(--ink-900)', lineHeight: 1 }}>{value}</div>
    </div>
  );
}
