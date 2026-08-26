export type RootStackParamList = {
  Landing: undefined;
  Home: undefined;
  Notifications: undefined;
  Profile: undefined;
  Kaki: undefined;
  Rounds: { initialTab?: 'live' | 'past' } | undefined;
  TrophyCabinet: undefined;
  BragCard: undefined;
  SelectCourse: undefined;
  JoinGame: undefined;
  CreateGame: {
    courseId: string;
    comboId: string;
    holesToPlay: 9 | 18;
    startHole: number;
    courseName: string;
    summaryLine: string;
  };
  MatchLobby: {
    matchId: string;
    matchCode: string;
    matchName: string;
    courseName: string;
    summaryLine: string;
    gameModeName: string;
    holesToPlay: 9 | 18;
  };
  Scorecard: {
    matchId: string;
    matchName: string;
    courseName: string;
    gameModeName: string;
    isHost: boolean;
  };
  Leaderboard: {
    matchId: string;
    matchName: string;
    courseName: string;
    gameModeName: string;
  };
  InGameLobby: {
    matchId: string;
    matchName: string;
    courseName: string;
    gameModeName: string;
  };
  Finish: {
    matchId: string;
    matchName: string;
    courseName: string;
    gameModeName: string;
  };
  Recap: {
    matchId: string;
    matchName: string;
    courseName: string;
    gameModeName: string;
  };
  /** The tournament (stroke play + Skins) creation wizard — a nested navigator (see navigation/TournamentNavigator.tsx) so its draft state (TournamentDraftContext) is scoped to just this flow's lifetime. */
  TournamentCreate: undefined;
  /** The live post-creation surface — a root-stack screen, not part of the wizard, since after S6b's "Create tournament" write the draft context is no longer the source of truth (the created rows are). Reached from S6b's create tap today; S7–S10 (later phases) will be siblings of this same route. */
  TournamentLobby: {
    tournamentId: string;
    matchId: string;
  };
  /** S7 — hole-by-hole live scoring, reached from S6c's "Start/Continue scoring" CTA once the match is live. Deliberately not part of the Kaki Match Play Scorecard/useLiveRound stack — see useTournamentRound's docblock. */
  TournamentScorecard: {
    tournamentId: string;
    matchId: string;
  };
  /** S8 — the read-only full 18-hole grid, reached from S7's "Card" header button. A lateral detail view of the same round, not a fresh root destination — its own back chevron and Scorecard tab both just goBack() to S7. */
  TournamentScorecardGrid: {
    tournamentId: string;
    matchId: string;
  };
  /** S9 — stroke-play standings + Skins results, reached from the Leaderboard tab on S6c/S7/S8. */
  TournamentLeaderboard: {
    tournamentId: string;
    matchId: string;
  };
  /** S10 — finish action + round-summary celebration in one screen (per the design handoff), reached from the Finish tab on S6c/S7/S8/S9. */
  TournamentFinish: {
    tournamentId: string;
    matchId: string;
  };
};

/** Screens inside the tournament creation wizard (S1–S6b today). All draft state lives in TournamentDraftContext, not route params — see that file for why. */
export type TournamentStackParamList = {
  TournamentFormat: undefined;
  TournamentCourse: undefined;
  TournamentRules: undefined;
  TournamentPlayers: undefined;
  TournamentSideGames: undefined;
  TournamentPreRound: undefined;
};
