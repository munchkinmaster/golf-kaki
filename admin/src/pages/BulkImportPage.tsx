import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, CircleCheck, CircleX, Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { createCourse, fetchCourseCatalog } from '../data/courses';
import { downloadImportTemplate, parseCourseImportWorkbook, readWorkbookFile, type CourseImportGroup } from '../data/bulkImportCourses';

type ImportOutcome = { ok: true; courseId: string } | { ok: false; message: string };

export function BulkImportPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [existingNames, setExistingNames] = useState<Set<string> | null>(null);
  useEffect(() => {
    fetchCourseCatalog()
      .then((courses) => setExistingNames(new Set(courses.map((c) => c.name.trim().toLowerCase()))))
      .catch(() => setExistingNames(new Set()));
  }, []);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [groups, setGroups] = useState<CourseImportGroup[] | null>(null);
  const [unnamedRowCount, setUnnamedRowCount] = useState(0);
  const [parsing, setParsing] = useState(false);

  const [importing, setImporting] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, ImportOutcome>>({});

  async function onFileChosen(file: File) {
    setFileName(file.name);
    setParseError(null);
    setGroups(null);
    setOutcomes({});
    setParsing(true);
    try {
      const workbook = await readWorkbookFile(file);
      const result = parseCourseImportWorkbook(workbook);
      setGroups(result.groups);
      setUnnamedRowCount(result.unnamedRowCount);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Couldn't read that file — make sure it's a .xlsx, .xls, or .csv export of the template.");
    } finally {
      setParsing(false);
    }
  }

  const importable = (groups ?? []).filter((g) => g.input !== null);

  async function runImport() {
    if (importing || importable.length === 0) return;
    setImporting(true);
    for (const group of importable) {
      try {
        const courseId = await createCourse(group.input!);
        setOutcomes((prev) => ({ ...prev, [group.courseName]: { ok: true, courseId } }));
      } catch (e) {
        setOutcomes((prev) => ({ ...prev, [group.courseName]: { ok: false, message: e instanceof Error ? e.message : 'Import failed.' } }));
      }
    }
    setImporting(false);
  }

  const importedCount = Object.values(outcomes).filter((o) => o.ok).length;
  const attemptedImport = Object.keys(outcomes).length > 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)' }}>
      <TopBar active="Courses" />
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '26px 28px 72px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--ink-400)', marginBottom: 10 }}>
          <span style={{ cursor: 'pointer' }} onClick={() => navigate('/courses')}>
            Courses
          </span>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--ink-700)' }}>Bulk import</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, letterSpacing: '-.015em', color: 'var(--ink-900)', lineHeight: 1.1 }}>
              Bulk import courses
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text-muted)', marginTop: 6, maxWidth: 640 }}>
              For standard 18-hole (front 9 + back 9) courses only — one spreadsheet row per hole. A 27-hole or
              multi-combo club still needs the manual{' '}
              <span style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }} onClick={() => navigate('/courses/new')}>
                Add course
              </span>{' '}
              form.
            </div>
          </div>
          <Button variant="ghost" onClick={() => navigate('/courses')}>
            <X size={16} />
            Cancel
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, boxShadow: 'var(--shadow-xs)', padding: '20px 22px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--ink-900)', marginBottom: 8 }}>
              1. Download the template
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
              Includes a fully-worked example course and a blank 18-row block per course. Add more courses by
              repeating an 18-row block underneath, one Course Name per course.
            </div>
            <Button variant="secondary" onClick={() => downloadImportTemplate()}>
              <Download size={16} />
              Download .xlsx template
            </Button>
          </div>

          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, boxShadow: 'var(--shadow-xs)', padding: '20px 22px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--ink-900)', marginBottom: 8 }}>
              2. Upload your filled-in copy
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
              .xlsx, .xls, or .csv. Nothing is saved until you review the preview below and click Import.
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFileChosen(file);
                e.target.value = '';
              }}
            />
            <Button variant="accent" onClick={() => fileInputRef.current?.click()} disabled={parsing}>
              <Upload size={16} />
              {parsing ? 'Reading…' : fileName ? 'Choose a different file' : 'Choose file'}
            </Button>
            {fileName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--ink-500)' }}>
                <FileSpreadsheet size={14} />
                {fileName}
              </div>
            )}
          </div>
        </div>

        {parseError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FBEAE7', border: '1.5px solid #E8B8AF', borderRadius: 14, padding: '15px 18px', marginBottom: 22 }}>
            <CircleX size={20} color="var(--status-danger)" />
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--status-danger)' }}>{parseError}</div>
          </div>
        )}

        {groups && (
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, boxShadow: 'var(--shadow-xs)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ink-900)' }}>
                  {groups.length} course{groups.length === 1 ? '' : 's'} found
                </div>
                {unnamedRowCount > 0 && (
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--status-warning)', marginTop: 3 }}>
                    {unnamedRowCount} row{unnamedRowCount === 1 ? '' : 's'} had no Course Name and were skipped.
                  </div>
                )}
              </div>
              {!attemptedImport && (
                <Button variant="accent" onClick={() => void runImport()} disabled={importing || importable.length === 0}>
                  {importing ? 'Importing…' : `Import ${importable.length} course${importable.length === 1 ? '' : 's'}`}
                </Button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {groups.map((group) => {
                const isDuplicate = existingNames?.has(group.courseName.trim().toLowerCase()) ?? false;
                const outcome = outcomes[group.courseName];
                const blockingIssues = group.issues.filter((i) => i.blocking);
                const warnings = group.issues.filter((i) => !i.blocking);

                return (
                  <div key={group.courseName} style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14.5, color: 'var(--ink-900)' }}>{group.courseName}</div>
                        <span style={{ fontFamily: 'var(--font-numeric)', fontSize: 12, fontWeight: 600, color: 'var(--ink-400)' }}>{group.rowCount} rows</span>
                        {isDuplicate && !outcome && (
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, color: 'var(--status-warning)', background: 'var(--orange-100)', border: '1px solid var(--orange-200)', borderRadius: 999, padding: '2px 9px' }}>
                            Name already exists
                          </span>
                        )}
                      </div>

                      {outcome ? (
                        outcome.ok ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--status-success)' }}>
                            <CircleCheck size={16} />
                            Imported as {group.status}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--status-danger)' }}>
                            <CircleX size={16} />
                            {outcome.message}
                          </div>
                        )
                      ) : blockingIssues.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--status-danger)' }}>
                          <CircleX size={16} />
                          Can't import
                        </div>
                      ) : (
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-500)' }}>Will import as {group.status}</div>
                      )}
                    </div>

                    {group.issues.length > 0 && !outcome && (
                      <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {blockingIssues.map((issue, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--status-danger)' }}>
                            <CircleX size={13} style={{ marginTop: 2, flex: 'none' }} />
                            {issue.message}
                          </div>
                        ))}
                        {warnings.map((issue, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--status-warning)' }}>
                            <AlertTriangle size={13} style={{ marginTop: 2, flex: 'none' }} />
                            {issue.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {attemptedImport && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px' }}>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--text-muted)' }}>
                  {importedCount} of {importable.length} imported.
                </div>
                <Button variant="primary" onClick={() => navigate('/courses')}>
                  Go to Courses
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
