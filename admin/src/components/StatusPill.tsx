const statusMap = {
  published: { label: 'Published', dot: 'var(--status-success)', bg: 'var(--green-50)', fg: 'var(--green-700)', bd: 'var(--green-200)' },
  draft: { label: 'Draft', dot: 'var(--ink-400)', bg: 'var(--sand-100)', fg: 'var(--ink-500)', bd: 'var(--sand-300)' },
} as const;

export function StatusPill({ status }: { status: keyof typeof statusMap }) {
  const s = statusMap[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 11px',
        borderRadius: 999,
        background: s.bg,
        border: `1px solid ${s.bd}`,
        fontFamily: 'var(--font-body)',
        fontSize: 12.5,
        fontWeight: 600,
        color: s.fg,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {s.label}
    </span>
  );
}
