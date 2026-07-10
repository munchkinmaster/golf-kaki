import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, ChevronRight, Clock, FilePen, Flag, Layers, MapPin, Plus, Search, SearchX } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { StatCard } from '../components/StatCard';
import { StatusPill } from '../components/StatusPill';
import { TeeDot } from '../components/TeeDot';
import { Button } from '../components/Button';
import { fetchCourseCatalog, totalPar, TEE_COLORS, type Course } from '../data/courses';

type Filter = 'all' | 'published' | 'draft';

export function CoursesListPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    fetchCourseCatalog()
      .then(setCourses)
      .catch((e: Error) => setError(e.message));
  }, []);

  const rows = useMemo(() => {
    if (!courses) return [];
    const q = query.trim().toLowerCase();
    return courses
      .filter((c) => filter === 'all' || c.status === filter)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.area.toLowerCase().includes(q));
  }, [courses, query, filter]);

  const totalHoles = courses?.reduce((n, c) => n + c.nines.length * 9, 0) ?? 0;
  const publishedCount = courses?.filter((c) => c.status === 'published').length ?? 0;
  const draftCount = courses?.filter((c) => c.status === 'draft').length ?? 0;

  const stats = [
    { label: 'Total courses', value: courses?.length ?? 0, icon: Layers, bg: 'var(--green-50)', fg: 'var(--green-700)' },
    { label: 'Published', value: publishedCount, icon: CircleCheck, bg: 'var(--green-50)', fg: 'var(--green-700)' },
    { label: 'Drafts', value: draftCount, icon: FilePen, bg: 'var(--orange-100)', fg: 'var(--orange-600)' },
    { label: 'Holes mapped', value: totalHoles, icon: Flag, bg: 'var(--sand-100)', fg: 'var(--ink-700)' },
  ];

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: courses?.length ?? 0 },
    { key: 'published', label: 'Published', count: publishedCount },
    { key: 'draft', label: 'Drafts', count: draftCount },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)' }}>
      <TopBar active="Courses" />
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '26px 28px 72px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, letterSpacing: '-.015em', color: 'var(--ink-900)', lineHeight: 1.1 }}>
              Courses
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text-muted)', marginTop: 6 }}>
              Manage the courses kakis can pick when they start a game. {publishedCount} published · {draftCount} draft.
            </div>
          </div>
          <Button variant="accent" onClick={() => navigate('/courses/new')}>
            <Plus size={18} />
            Add course
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 420 }}>
            <Search size={17} color="var(--ink-400)" style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search course or location"
              style={{
                width: '100%',
                height: 44,
                padding: '0 16px 0 42px',
                border: '1.5px solid var(--border-default)',
                borderRadius: 999,
                fontFamily: 'var(--font-body)',
                fontSize: 14.5,
                fontWeight: 500,
                color: 'var(--ink-900)',
                background: '#fff',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'inline-flex', background: 'var(--sand-200)', borderRadius: 999, padding: 4 }}>
            {tabs.map((t) => {
              const selected = filter === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setFilter(t.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    height: 36,
                    padding: '0 16px',
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: 999,
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize: 13.5,
                    background: selected ? '#fff' : 'transparent',
                    color: selected ? 'var(--ink-900)' : 'var(--ink-500)',
                    boxShadow: selected ? 'var(--shadow-xs)' : 'none',
                  }}
                >
                  {t.label}
                  <span
                    style={{
                      fontFamily: 'var(--font-numeric)',
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: '1px 7px',
                      borderRadius: 999,
                      background: selected ? 'var(--green-50)' : 'rgba(28,43,34,.06)',
                      color: selected ? 'var(--green-700)' : 'var(--ink-400)',
                    }}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, boxShadow: 'var(--shadow-xs)', overflow: 'hidden' }}>
          <div style={rowGridStyle('var(--sand-50)', '1px solid var(--border-default)')}>
            {['Course', 'Holes', 'Par', 'Tees', 'Status', 'Last edited', ''].map((h) => (
              <div key={h} style={headerCellStyle}>
                {h}
              </div>
            ))}
          </div>

          {error && <div style={{ padding: 22, color: 'var(--status-danger)', fontFamily: 'var(--font-body)' }}>Couldn't load courses: {error}</div>}

          {!error &&
            rows.map((c) => {
              const combo = c.combos[0];
              return (
                <div
                  key={c.id}
                  className="gk-course-row"
                  onClick={() => navigate(`/courses/${c.id}`)}
                  style={{ ...rowGridStyle('#fff', '1px solid var(--border-subtle)'), cursor: 'pointer', transition: 'background .15s' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 11,
                        background: 'var(--green-50)',
                        border: '1px solid var(--green-100)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                      }}
                    >
                      <Flag size={18} color="var(--green-700)" />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        <MapPin size={12} />
                        {c.area}
                      </div>
                    </div>
                  </div>
                  <div style={numericCellStyle}>{c.nines.length * 9}</div>
                  <div style={numericCellStyle}>{totalPar(c, combo)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {TEE_COLORS.map((tee) => (
                      <TeeDot key={tee} tee={tee} />
                    ))}
                  </div>
                  <div>
                    <StatusPill status={c.status} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}></div>
                  <div className="gk-row-edit" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <ChevronRight size={19} color="var(--ink-400)" />
                  </div>
                </div>
              );
            })}

          {!error && courses && rows.length === 0 && (
            <div style={{ padding: '56px 22px', textAlign: 'center' }}>
              <span
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: '50%',
                  background: 'var(--sand-100)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                <SearchX size={24} color="var(--ink-400)" />
              </span>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--ink-900)' }}>No courses found</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', marginTop: 5 }}>Try a different search or filter.</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
          <span>
            Showing {rows.length} of {courses?.length ?? 0} courses
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} />
            Synced just now
          </span>
        </div>
      </div>
    </div>
  );
}

function rowGridStyle(background: string, borderBottom: string): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '1fr 96px 84px 92px 120px 132px 44px',
    alignItems: 'center',
    gap: 14,
    padding: '14px 22px',
    background,
    borderBottom,
  };
}

const headerCellStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--ink-400)',
};

const numericCellStyle: React.CSSProperties = {
  fontFamily: 'var(--font-numeric)',
  fontWeight: 600,
  fontSize: 14.5,
  color: 'var(--ink-700)',
};
