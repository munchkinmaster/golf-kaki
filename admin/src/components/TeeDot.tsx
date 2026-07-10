import { TEE_SWATCH, type TeeColor } from '../data/courses';

export function TeeDot({ tee, size = 15, active }: { tee: TeeColor; size?: number; active?: boolean }) {
  const swatch = TEE_SWATCH[tee];
  return (
    <span
      title={swatch.name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: swatch.color,
        border: `${active ? 2 : 1.5}px solid ${swatch.ring}`,
        boxShadow: active ? '0 0 0 3px var(--green-100)' : 'none',
        flex: 'none',
        display: 'inline-block',
      }}
    />
  );
}
