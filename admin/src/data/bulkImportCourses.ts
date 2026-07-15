/**
 * Bulk course import from a spreadsheet — deliberately scoped to the common
 * case only: one flat sheet, one row per hole, for a standard 18-hole
 * (front 9 + back 9, single combo) course. A 27+-hole club's stroke index
 * varies per nine-pairing and its ratings vary per combo, neither of which
 * fits a flat per-hole row — those still go through the manual Add Course
 * form (see AddCoursePage/NineEditor/ComboEditor).
 */

import * as XLSX from 'xlsx';

import { TEE_COLORS, type ComboRating, type CourseStatus, type CourseWriteInput, type TeeColor } from './courses';

const FRONT_NINE_ID = 'front';
const BACK_NINE_ID = 'back';
const FRONT_NINE_NAME = 'Front nine';
const BACK_NINE_NAME = 'Back nine';
const COMBO_ID = `${FRONT_NINE_ID}-${BACK_NINE_ID}`;
const COMBO_LABEL = `${FRONT_NINE_NAME} + ${BACK_NINE_NAME}`;

type FieldKey =
  | 'courseName'
  | 'area'
  | 'status'
  | 'latitude'
  | 'longitude'
  | 'hole'
  | 'par'
  | 'yardageBlack'
  | 'yardageBlue'
  | 'yardageWhite'
  | 'yardageRed'
  | 'strokeIndex'
  | 'ratingBlack'
  | 'slopeBlack'
  | 'ratingBlue'
  | 'slopeBlue'
  | 'ratingWhite'
  | 'slopeWhite'
  | 'ratingRed'
  | 'slopeRed';

const COLUMNS: { key: FieldKey; label: string }[] = [
  { key: 'courseName', label: 'Course Name' },
  { key: 'area', label: 'Area / Location' },
  { key: 'status', label: 'Status (draft/published)' },
  { key: 'latitude', label: 'Latitude' },
  { key: 'longitude', label: 'Longitude' },
  { key: 'hole', label: 'Hole (1-18)' },
  { key: 'par', label: 'Par' },
  { key: 'yardageBlack', label: 'Yardage Black' },
  { key: 'yardageBlue', label: 'Yardage Blue' },
  { key: 'yardageWhite', label: 'Yardage White' },
  { key: 'yardageRed', label: 'Yardage Red' },
  { key: 'strokeIndex', label: 'Stroke Index (1-18)' },
  { key: 'ratingBlack', label: 'Rating Black' },
  { key: 'slopeBlack', label: 'Slope Black' },
  { key: 'ratingBlue', label: 'Rating Blue' },
  { key: 'slopeBlue', label: 'Slope Blue' },
  { key: 'ratingWhite', label: 'Rating White' },
  { key: 'slopeWhite', label: 'Slope White' },
  { key: 'ratingRed', label: 'Rating Red' },
  { key: 'slopeRed', label: 'Slope Red' },
];

function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A few forgiving aliases for the columns most likely to get retyped by hand, alongside the exact template labels. */
const HEADER_ALIASES: Record<string, FieldKey> = {
  'course name': 'courseName',
  area: 'area',
  'area location': 'area',
  location: 'area',
  status: 'status',
  'status draft published': 'status',
  latitude: 'latitude',
  longitude: 'longitude',
  hole: 'hole',
  'hole 1 18': 'hole',
  par: 'par',
  'yardage black': 'yardageBlack',
  'yardage blue': 'yardageBlue',
  'yardage white': 'yardageWhite',
  'yardage red': 'yardageRed',
  'stroke index': 'strokeIndex',
  'stroke index 1 18': 'strokeIndex',
  si: 'strokeIndex',
  'rating black': 'ratingBlack',
  'slope black': 'slopeBlack',
  'rating blue': 'ratingBlue',
  'slope blue': 'slopeBlue',
  'rating white': 'ratingWhite',
  'slope white': 'slopeWhite',
  'rating red': 'ratingRed',
  'slope red': 'slopeRed',
};

function toNum(s: string | undefined): number | null {
  if (s === undefined) return null;
  const trimmed = s.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function firstNonBlank(rows: Record<FieldKey, string>[], key: FieldKey): string {
  return rows.map((r) => r[key]).find((v) => v && v.trim() !== '') ?? '';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function readSheetRows(workbook: XLSX.WorkBook): Record<FieldKey, string>[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return raw.map((row) => {
    const mapped = {} as Record<FieldKey, string>;
    for (const [rawHeader, value] of Object.entries(row)) {
      const key = HEADER_ALIASES[normalizeHeader(rawHeader)];
      if (key) mapped[key] = String(value ?? '').trim();
    }
    return mapped;
  });
}

export type CourseImportIssue = { message: string; blocking: boolean };

export type CourseImportGroup = {
  courseName: string;
  rowCount: number;
  status: CourseStatus;
  issues: CourseImportIssue[];
  /** Null when a blocking issue prevented building a valid write payload. */
  input: CourseWriteInput | null;
};

export type CourseImportResult = {
  groups: CourseImportGroup[];
  /** Rows with no Course Name at all — can't be attributed to any course, so they're dropped rather than guessed at. */
  unnamedRowCount: number;
};

function buildCourseGroup(courseName: string, rows: Record<FieldKey, string>[]): CourseImportGroup {
  const issues: CourseImportIssue[] = [];

  const area = firstNonBlank(rows, 'area');
  if (!area) issues.push({ message: 'Missing Area / Location.', blocking: true });

  const statusRaw = firstNonBlank(rows, 'status').toLowerCase();
  let status: CourseStatus = 'draft';
  if (statusRaw === 'published') status = 'published';
  else if (statusRaw && statusRaw !== 'draft') {
    issues.push({ message: `Unrecognized Status "${statusRaw}" — defaulted to draft.`, blocking: false });
  }

  const latitude = toNum(firstNonBlank(rows, 'latitude'));
  const longitude = toNum(firstNonBlank(rows, 'longitude'));

  // One row per hole, keyed by its Hole number (1-18: 1-9 front, 10-18 back —
  // same convention as src/data/courses.ts's getComboHoles).
  const holeByN = new Map<number, Record<FieldKey, string>>();
  for (const row of rows) {
    const n = toNum(row.hole);
    if (n === null || !Number.isInteger(n) || n < 1 || n > 18) {
      issues.push({ message: `Invalid Hole value "${row.hole}".`, blocking: true });
      continue;
    }
    if (holeByN.has(n)) {
      issues.push({ message: `Hole ${n} appears more than once.`, blocking: true });
      continue;
    }
    holeByN.set(n, row);
  }
  const missingHoles = Array.from({ length: 18 }, (_, i) => i + 1).filter((n) => !holeByN.has(n));
  if (missingHoles.length > 0) {
    issues.push({ message: `Missing hole${missingHoles.length > 1 ? 's' : ''}: ${missingHoles.join(', ')}.`, blocking: true });
  }

  type HoleParsed = { par: number; si: number | null; yardageM: Record<TeeColor, number | null> };
  const holeData = new Map<number, HoleParsed>();
  const siValues: number[] = [];
  let siCompleteCount = 0;

  for (const [n, row] of holeByN) {
    const par = toNum(row.par);
    if (par === null || ![3, 4, 5, 6].includes(par)) {
      issues.push({ message: `Hole ${n}: Par must be 3, 4, 5, or 6 (got "${row.par}").`, blocking: true });
      continue;
    }
    const si = toNum(row.strokeIndex);
    if (si !== null) {
      if (!Number.isInteger(si) || si < 1 || si > 18) {
        issues.push({ message: `Hole ${n}: Stroke Index must be 1-18 (got "${row.strokeIndex}").`, blocking: true });
      } else {
        siValues.push(si);
        siCompleteCount++;
      }
    }
    holeData.set(n, {
      par,
      si,
      yardageM: {
        black: toNum(row.yardageBlack),
        blue: toNum(row.yardageBlue),
        white: toNum(row.yardageWhite),
        red: toNum(row.yardageRed),
      },
    });
  }

  if (new Set(siValues).size !== siValues.length) {
    issues.push({ message: 'Stroke Index values must be unique across all 18 holes.', blocking: true });
  }
  const siComplete = siCompleteCount === 18 && new Set(siValues).size === 18;
  if (!siComplete) {
    issues.push({ message: "Stroke Index isn't filled in (or isn't unique 1-18) for every hole — fine for a draft, required before publishing.", blocking: false });
  }

  const ratings: ComboRating[] = [];
  for (const tee of TEE_COLORS) {
    const ratingKey = `rating${capitalize(tee)}` as FieldKey;
    const slopeKey = `slope${capitalize(tee)}` as FieldKey;
    const ratingStr = firstNonBlank(rows, ratingKey);
    const slopeStr = firstNonBlank(rows, slopeKey);
    if (!ratingStr || !slopeStr) continue;
    const courseRating = toNum(ratingStr);
    const slopeRating = toNum(slopeStr);
    if (courseRating !== null && slopeRating !== null) ratings.push({ teeColor: tee, courseRating, slopeRating });
  }
  if (ratings.length === 0) {
    issues.push({ message: 'No Rating/Slope filled in for any tee — fine for a draft, required before publishing.', blocking: false });
  }

  const blocking = issues.some((i) => i.blocking);
  if (blocking) {
    return { courseName, rowCount: rows.length, status, issues, input: null };
  }

  // Requested "published" but the data isn't actually publish-ready — import
  // as a draft instead of silently shipping an incomplete course live.
  const publishReady = siComplete && ratings.length > 0;
  if (status === 'published' && !publishReady) {
    status = 'draft';
    issues.push({ message: 'Requested "published" but Stroke Index/Rating aren’t complete — imported as draft instead.', blocking: false });
  }

  const frontHoles = Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
    const d = holeData.get(n)!;
    return { n, par: d.par, yardageM: d.yardageM, siByPartner: d.si === null ? {} : { [BACK_NINE_ID]: d.si } };
  });
  const backHoles = Array.from({ length: 9 }, (_, i) => i + 10).map((n) => {
    const d = holeData.get(n)!;
    return { n: n - 9, par: d.par, yardageM: d.yardageM, siByPartner: d.si === null ? {} : { [FRONT_NINE_ID]: d.si } };
  });

  const input: CourseWriteInput = {
    name: courseName,
    area,
    latitude,
    longitude,
    status,
    nines: [
      { id: FRONT_NINE_ID, name: FRONT_NINE_NAME, holes: frontHoles },
      { id: BACK_NINE_ID, name: BACK_NINE_NAME, holes: backHoles },
    ],
    combos: [{ id: COMBO_ID, label: COMBO_LABEL, front: FRONT_NINE_ID, back: BACK_NINE_ID }],
    ratingsByCombo: { [COMBO_ID]: ratings },
  };

  return { courseName, rowCount: rows.length, status, issues, input };
}

/** Parses the first sheet of an uploaded workbook into one group per distinct Course Name. */
export function parseCourseImportWorkbook(workbook: XLSX.WorkBook): CourseImportResult {
  const rows = readSheetRows(workbook);

  const byName = new Map<string, Record<FieldKey, string>[]>();
  const order: string[] = [];
  let unnamedRowCount = 0;

  for (const row of rows) {
    const name = row.courseName?.trim();
    if (!name) {
      // A fully blank row (common at the end of a sheet) has nothing else
      // filled in either — only count it as a dropped row if it looks like
      // someone was actually trying to fill in hole data.
      if (Object.values(row).some((v) => v && v.trim() !== '')) unnamedRowCount++;
      continue;
    }
    if (!byName.has(name)) {
      byName.set(name, []);
      order.push(name);
    }
    byName.get(name)!.push(row);
  }

  return { groups: order.map((name) => buildCourseGroup(name, byName.get(name)!)), unnamedRowCount };
}

/** Reads a File (from an <input type="file">) into a parsed SheetJS workbook. */
export async function readWorkbookFile(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: 'array' });
}

const EXAMPLE_PARS = [4, 4, 3, 5, 4, 4, 5, 3, 4, 4, 4, 4, 5, 3, 4, 5, 3, 4];
const PAR_YARDAGE_BLUE: Record<number, number> = { 3: 160, 4: 375, 5: 495 };

/** A fully-worked example course (18 holes, one combo) so the shape/expectations are obvious, plus a second, blank template row block ready to fill in. */
function exampleRows(): Record<string, string | number>[] {
  return EXAMPLE_PARS.map((par, i) => {
    const n = i + 1;
    const row: Record<string, string | number> = {
      'Course Name': 'Example Golf Club',
      'Area / Location': n === 1 ? 'City, Country' : '',
      'Status (draft/published)': n === 1 ? 'draft' : '',
      Latitude: '',
      Longitude: '',
      'Hole (1-18)': n,
      Par: par,
      'Yardage Black': '',
      'Yardage Blue': PAR_YARDAGE_BLUE[par]!,
      'Yardage White': '',
      'Yardage Red': '',
      'Stroke Index (1-18)': n,
      'Rating Black': '',
      'Slope Black': '',
      'Rating Blue': n === 1 ? 70.5 : '',
      'Slope Blue': n === 1 ? 126 : '',
      'Rating White': '',
      'Slope White': '',
      'Rating Red': '',
      'Slope Red': '',
    };
    return row;
  });
}

function blankRows(): Record<string, string | number>[] {
  return Array.from({ length: 18 }, (_, i) => {
    const row: Record<string, string | number> = { 'Hole (1-18)': i + 1 };
    for (const col of COLUMNS) if (!(col.label in row)) row[col.label] = '';
    return row;
  });
}

/** Builds the downloadable .xlsx template: header row, one fully-worked example course, then one blank 18-row block ready to fill in. */
export function buildImportTemplateWorkbook(): XLSX.WorkBook {
  const headerOrder = COLUMNS.map((c) => c.label);
  const rows = [...exampleRows(), ...blankRows()];
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headerOrder });
  sheet['!cols'] = headerOrder.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Courses');
  return workbook;
}

export function downloadImportTemplate(): void {
  const workbook = buildImportTemplateWorkbook();
  XLSX.writeFile(workbook, 'golf-kaki-course-import-template.xlsx');
}
