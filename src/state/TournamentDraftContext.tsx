import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { TeeColor } from '../data/courses';
import { generateTournamentCodePreview } from '../data/tournaments';
import type { SkinsConfig } from '../data/skins';

/**
 * Local wizard state for S1–S6b of the tournament creation flow. Deliberately
 * NOT threaded through navigation route params (unlike the simpler
 * SelectCourse -> CreateGame handoff) — by S5 the draft carries a players
 * array and side-game config nested deep enough that re-passing a growing
 * params object at every navigate() call would be worse than a scoped
 * context. Nothing here is written to Supabase until S6b's "Create
 * tournament" tap (see the migration comment in
 * 20260810120000_tournament_stroke_play.sql) — this type is shaped to match
 * that eventual write 1:1 so wiring it up later is "send this object," not
 * "redesign this object."
 */
export type TournamentFormat = 'stroke_play' | 'stableford' | 'system_36'; // only 'stroke_play' is buildable today — see S1
export type PlayAs = 'individual' | 'team'; // only 'individual' is buildable today
export type RoundStructure = 'single' | 'multi'; // only 'single' is buildable today
export type StandingsBasis = 'nett' | 'gross' | 'both';
export type TieBreakRule = 'countback' | 'shared_place';

export type TournamentPlayerDraft = {
  id: string;
  name: string;
  handicapIndex: number | null;
  isHost: boolean;
  /** Mirrors match_players.status ('joined' | 'invited') — the host is seated outright, everyone else stays 'invited' until Phase 4 actually creates their row and they accept. */
  status: 'joined' | 'invited';
  tee: TeeColor;
  playingHandicap: number;
  handicapOverride: boolean;
};

export type TournamentDraft = {
  name: string;
  playAs: PlayAs;
  roundStructure: RoundStructure;
  format: TournamentFormat;
  courseId: string | null;
  comboId: string | null;
  defaultTee: TeeColor | null;
  /** Shotgun start — which hole the whole field tees off from and plays 18 in order from (mirrors matches.start_hole; same "everyone plays as one group" semantics as the existing Kaki Match Play picker in SelectCourseScreen). Defaults to 1 (identity order). */
  startHole: number;
  standingsBasis: StandingsBasis;
  handicapAllowancePct: number; // 0-100
  tieBreakRule: TieBreakRule;
  players: TournamentPlayerDraft[];
  sideGames: SkinsConfig[];
  /** Client-side preview invite code (see generateTournamentCodePreview) — generated once per wizard entry so S4 and S6b display the SAME code, and reused as the actual insert value on create (may get swapped for a fresh one if it collides). */
  code: string;
  /**
   * Set the moment the host's first invite on S4 creates the real
   * tournament + match row — null until then. From that point on, S4's
   * further invites/removes/edits and S5's side-game edits write live
   * instead of only touching this local draft, and S1–S3 lock further
   * changes (Format/Course/Rules can't drift from what an already-invited
   * player's row reflects). A host who never invites anyone keeps both null
   * all the way to S6b's single-shot "Create tournament".
   */
  tournamentId: string | null;
  matchId: string | null;
};

const DEFAULT_DRAFT: Omit<TournamentDraft, 'code'> = {
  name: 'Weekend Medal',
  playAs: 'individual',
  roundStructure: 'single',
  format: 'stroke_play',
  courseId: null,
  comboId: null,
  defaultTee: null,
  startHole: 1,
  standingsBasis: 'nett',
  handicapAllowancePct: 95,
  tieBreakRule: 'countback',
  players: [],
  sideGames: [],
  tournamentId: null,
  matchId: null,
};

function freshDraft(): TournamentDraft {
  return { ...DEFAULT_DRAFT, code: generateTournamentCodePreview() };
}

type TournamentDraftContextValue = {
  draft: TournamentDraft;
  update: (patch: Partial<TournamentDraft>) => void;
  reset: () => void;
};

const TournamentDraftContext = createContext<TournamentDraftContextValue | null>(null);

export function TournamentDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<TournamentDraft>(freshDraft);

  const update = useCallback((patch: Partial<TournamentDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);
  const reset = useCallback(() => setDraft(freshDraft()), []);

  const value = useMemo(() => ({ draft, update, reset }), [draft, update, reset]);

  return <TournamentDraftContext.Provider value={value}>{children}</TournamentDraftContext.Provider>;
}

export function useTournamentDraft(): TournamentDraftContextValue {
  const ctx = useContext(TournamentDraftContext);
  if (!ctx) throw new Error('useTournamentDraft must be used within a TournamentDraftProvider');
  return ctx;
}
