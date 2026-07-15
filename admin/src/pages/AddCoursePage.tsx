import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Check, Flag, Info, MapPin, X } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Checklist } from '../components/Checklist';
import { NineEditor } from '../components/NineEditor';
import { ComboEditor } from '../components/ComboEditor';
import { createCourse, fetchCourseCatalog, updateCourse } from '../data/courses';
import { courseToDraft, deriveCombos, draftToCourseInput, newNine, validateDraft, type ComboDraft, type NineDraft } from '../data/courseDraft';
import mark from '../assets/golf-kaki-mark.svg';

export function AddCoursePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [nines, setNines] = useState<NineDraft[]>(() => [newNine('Front nine'), newNine('Back nine')]);
  const [combos, setCombos] = useState<ComboDraft[]>([]);
  const [draggedComboKey, setDraggedComboKey] = useState<string | null>(null);
  const [activeNine, setActiveNine] = useState(0);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedAs, setSavedAs] = useState<'published' | 'draft' | null>(null);
  const [savedCourseId, setSavedCourseId] = useState<string | null>(id ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchCourseCatalog()
      .then((all) => {
        const course = all.find((c) => c.id === id);
        if (!course) {
          setLoadError(`No course found with id "${id}".`);
          return;
        }
        const draft = courseToDraft(course);
        setName(draft.name);
        setArea(draft.area);
        setLatitude(draft.latitude);
        setLongitude(draft.longitude);
        setNines(draft.nines);
        // Guard against combos left over from an earlier nine that no longer exists (e.g. an
        // interrupted save) — deriveCombos will regenerate a clean set once nines settle.
        const nineIds = new Set(draft.nines.map((n) => n.id));
        setCombos(draft.combos.filter((c) => nineIds.has(c.front) && nineIds.has(c.back)));
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Keep combos in sync whenever nines change (add/remove/rename a nine reshapes the pairwise combo list).
  const nineIdentity = nines.map((n) => `${n.id}:${n.name}`).join(',');
  useEffect(() => {
    setCombos((prev) => deriveCombos(nines, prev));
    // nineIdentity (ids + names) intentionally stands in for `nines` here — combos only
    // need to be re-derived when nines are added/removed/renamed, not on every hole edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nineIdentity]);

  const checks = useMemo(() => validateDraft(name, nines, combos), [name, nines, combos]);

  // Combo array order is what the app's course picker shows first (course_combos.position
  // is written from this array's index on save) — dragging a card reorders this list.
  function moveCombo(targetKey: string) {
    if (!draggedComboKey || draggedComboKey === targetKey) return;
    setCombos((prev) => {
      const from = prev.findIndex((c) => c.key === draggedComboKey);
      const to = prev.findIndex((c) => c.key === targetKey);
      if (from === -1 || to === -1) return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }

  const firstCombo = combos[0];
  const firstComboFront = firstCombo ? nines.find((n) => n.id === firstCombo.front) : undefined;
  const firstComboBack = firstCombo ? nines.find((n) => n.id === firstCombo.back) : undefined;
  const totalPar =
    firstComboFront && firstComboBack ? [...firstComboFront.holes, ...firstComboBack.holes].reduce((s, h) => s + h.par, 0) : 0;

  const checklistItems = [
    { label: 'Course name added', ok: checks.nameOk },
    { label: 'At least 2 nines added', ok: checks.enoughNines },
    { label: 'Par & distances set for every hole', ok: checks.ninesFilledOk },
    { label: 'Stroke index 1–18, no repeats, per combo', ok: checks.combosSiOk },
    { label: 'Rating & slope on at least one tee, per combo', ok: checks.combosRatingOk },
  ];

  async function save(status: 'published' | 'draft') {
    if (saving) return;
    if (status === 'published' ? !checks.canSave : !checks.canSaveDraft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const input = draftToCourseInput(name, area, latitude, longitude, status, nines, combos);
      const savedId = savedCourseId ? await updateCourse(savedCourseId, input) : await createCourse(input);
      setSavedCourseId(savedId);
      setSavedAs(status);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const publish = () => void save('published');
  const saveDraft = () => void save('draft');

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface-page)' }}>
        <TopBar active="Courses" />
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '60px 28px', fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>Loading course…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface-page)' }}>
        <TopBar active="Courses" />
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '60px 28px', fontFamily: 'var(--font-body)', color: 'var(--status-danger)' }}>{loadError}</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)' }}>
      <TopBar active="Courses" />
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '26px 28px 72px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--ink-400)', marginBottom: 10 }}>
          <span style={{ cursor: 'pointer' }} onClick={() => navigate('/courses')}>
            Courses
          </span>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--ink-700)' }}>{isEdit ? 'Edit course' : 'Add course'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, letterSpacing: '-.015em', color: 'var(--ink-900)', lineHeight: 1.1 }}>
              {isEdit ? 'Edit course' : 'Add a course'}
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text-muted)', marginTop: 6 }}>
              Par & distance are set per nine. Stroke index and rating/slope are set per 18-hole combo.
            </div>
          </div>
          <Button variant="ghost" onClick={() => navigate('/courses')}>
            <X size={16} />
            Cancel
          </Button>
        </div>

        {savedAs && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--green-50)', border: '1.5px solid var(--green-200)', borderRadius: 14, padding: '15px 18px', marginBottom: 22 }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--green-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <Check size={18} color="#fff" />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--green-800)' }}>
                {savedAs === 'published' ? 'Course published' : 'Draft saved'}
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink-700)' }}>
                {name.trim() || 'Untitled course'} ·{' '}
                {savedAs === 'published'
                  ? `${combos.length} combo${combos.length === 1 ? '' : 's'} ready to select when creating a game.`
                  : 'not visible to kakis yet.'}
              </div>
            </div>
            <button onClick={() => setSavedAs(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--green-700)', display: 'flex' }}>
              <X size={18} />
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 336px', gap: 26, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, boxShadow: 'var(--shadow-xs)', padding: '22px 22px 24px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ink-900)', marginBottom: 18 }}>Course details</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Input label="Course name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tasik Puteri Golf & Country Club" />
                <Input label="Area / location" value={area} onChange={(e) => setArea(e.target.value)} placeholder="City, country" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Input
                    label="Latitude (optional)"
                    inputMode="decimal"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value.replace(/[^0-9.\-]/g, ''))}
                    placeholder="e.g. 3.3178"
                  />
                  <Input
                    label="Longitude (optional)"
                    inputMode="decimal"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value.replace(/[^0-9.\-]/g, ''))}
                    placeholder="e.g. 101.5792"
                  />
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', marginTop: -8 }}>
                  Powers "courses near me" sorting once that ships in the app — safe to leave blank for now.
                </div>
              </div>
            </div>

            <NineEditor nines={nines} activeNine={activeNine} onSelectNine={setActiveNine} onChange={setNines} />

            {combos.map((combo) => {
              const front = nines.find((n) => n.id === combo.front);
              const back = nines.find((n) => n.id === combo.back);
              if (!front || !back) return null;
              return (
                <div
                  key={combo.key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => moveCombo(combo.key)}
                  style={{ opacity: draggedComboKey === combo.key ? 0.5 : 1 }}
                >
                  <ComboEditor
                    combo={combo}
                    front={front}
                    back={back}
                    onChange={(next) => setCombos((prev) => prev.map((c) => (c.key === combo.key ? next : c)))}
                    dragHandleProps={
                      combos.length > 1
                        ? {
                            draggable: true,
                            onDragStart: () => setDraggedComboKey(combo.key),
                            onDragEnd: () => setDraggedComboKey(null),
                          }
                        : undefined
                    }
                  />
                </div>
              );
            })}
          </div>

          <div style={{ position: 'sticky', top: 86, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ background: 'var(--green-800)', borderRadius: 16, padding: 22, color: '#fff', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
              <img src={mark} alt="" style={{ position: 'absolute', right: -34, top: -30, width: 150, opacity: 0.1, filter: 'brightness(0) invert(1)', pointerEvents: 'none' }} />
              <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--orange-300)', marginBottom: 9, position: 'relative' }}>
                Course preview
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, lineHeight: 1.15, position: 'relative' }}>{name.trim() || 'Untitled course'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)', fontSize: 13, color: 'rgba(255,255,255,.72)', marginTop: 5, position: 'relative' }}>
                <MapPin size={14} />
                {area.trim() || 'Location not set'}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 18, position: 'relative' }}>
                {[
                  { value: totalPar, label: 'Total par' },
                  { value: nines.length * 9, label: 'Holes' },
                  { value: combos.length, label: 'Combos' },
                ].map((t) => (
                  <div key={t.label} style={{ flex: 1, background: 'rgba(255,255,255,.10)', borderRadius: 12, padding: '11px 12px' }}>
                    <div style={{ fontFamily: 'var(--font-numeric)', fontWeight: 700, fontSize: 22, lineHeight: 1 }}>{t.value}</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'rgba(255,255,255,.6)', marginTop: 3 }}>{t.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 14, position: 'relative' }}>
                {nines.map((n) => (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.10)', borderRadius: 999, padding: '4px 10px' }}>
                    <Flag size={12} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, color: '#fff' }}>{n.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <Checklist items={checklistItems} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {saveError && (
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--status-danger)' }}>{saveError}</div>
              )}
              <Button variant="accent" size="lg" block onClick={publish} disabled={!checks.canSave || saving}>
                <Flag size={18} />
                {saving ? 'Saving…' : 'Publish course'}
              </Button>
              <Button variant="secondary" size="lg" block onClick={saveDraft} disabled={!checks.canSaveDraft || saving}>
                {saving ? 'Saving…' : 'Save as draft'}
              </Button>
              {!checks.canSave && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--text-muted)', justifyContent: 'center', marginTop: 2 }}>
                  <Info size={14} />
                  Resolve the checklist to publish.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
