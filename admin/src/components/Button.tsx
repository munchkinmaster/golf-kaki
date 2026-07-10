import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

const base: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  border: 'none',
  borderRadius: 'var(--radius-pill)',
  fontFamily: 'var(--font-body)',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'transform 120ms var(--ease-out), opacity 120ms var(--ease-out)',
};

const sizeStyle: Record<Size, React.CSSProperties> = {
  md: { height: 40, padding: '0 18px', fontSize: 14.5 },
  lg: { height: 52, padding: '0 22px', fontSize: 16 },
};

const variantStyle: Record<Variant, React.CSSProperties> = {
  primary: { background: 'var(--primary)', color: '#fff' },
  accent: { background: 'var(--accent)', color: '#fff', boxShadow: 'var(--shadow-accent)' },
  secondary: { background: 'var(--surface-card)', color: 'var(--text-primary)', border: '1.5px solid var(--border-default)' },
  ghost: { background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border-default)' },
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children: ReactNode;
};

export function Button({ variant = 'primary', size = 'md', block, style, disabled, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        ...base,
        ...sizeStyle[size],
        ...variantStyle[variant],
        width: block ? '100%' : undefined,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
