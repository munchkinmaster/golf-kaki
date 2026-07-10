import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function Input({ label, style, ...rest }: Props) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      {label && (
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--ink-700)' }}>
          {label}
        </span>
      )}
      <input
        {...rest}
        style={{
          height: 44,
          padding: '0 14px',
          border: '1.5px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-body)',
          fontSize: 14.5,
          fontWeight: 500,
          color: 'var(--ink-900)',
          background: '#fff',
          outline: 'none',
          width: '100%',
          ...style,
        }}
      />
    </label>
  );
}
