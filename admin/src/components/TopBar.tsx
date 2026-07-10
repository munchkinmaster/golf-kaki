import { LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import mark from '../assets/golf-kaki-mark.svg';
import { useAuth } from '../state/AuthContext';

const navItems = ['Members', 'Courses', 'Rounds'] as const;

function initialsFor(email: string | undefined): string {
  if (!email) return '';
  const name = email.split('@')[0] ?? '';
  const parts = name.split(/[._-]/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]![0], parts[1]![0]] : [name[0], name[1]];
  return letters.filter(Boolean).join('').toUpperCase();
}

export function TopBar({ active }: { active: (typeof navItems)[number] }) {
  const { session, signOut } = useAuth();
  const email = session?.user.email;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        height: 62,
        background: 'var(--green-800)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        boxShadow: '0 2px 10px rgba(14,58,40,.22)',
      }}
    >
      <Link to="/courses" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none' }}>
        <img src={mark} alt="" style={{ width: 32, height: 32, filter: 'brightness(0) invert(1)' }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: '#fff', letterSpacing: '-.01em' }}>
          Golf Kaki
        </span>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: '#fff',
            background: 'rgba(255,255,255,.14)',
            border: '1px solid rgba(255,255,255,.2)',
            padding: '4px 10px',
            borderRadius: 999,
          }}
        >
          Admin
        </span>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600 }}>
          {navItems.map((item) => (
            <span
              key={item}
              style={{
                position: 'relative',
                color: item === active ? '#fff' : 'rgba(255,255,255,.7)',
              }}
            >
              {item}
              {item === active && (
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -21,
                    height: 3,
                    background: 'var(--orange-500)',
                    borderRadius: 3,
                  }}
                />
              )}
            </span>
          ))}
        </div>
        <div
          title={email}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: '#DFEEDC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 13,
            color: 'var(--green-800)',
          }}
        >
          {initialsFor(email)}
        </div>
        <button
          onClick={() => void signOut()}
          title="Sign out"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 34,
            height: 34,
            border: 'none',
            borderRadius: '50%',
            background: 'transparent',
            color: 'rgba(255,255,255,.85)',
            cursor: 'pointer',
          }}
        >
          <LogOut size={17} />
        </button>
      </div>
    </div>
  );
}
