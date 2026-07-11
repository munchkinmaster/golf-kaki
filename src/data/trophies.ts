import { Bird, Flame, Gauge, Repeat, ShieldCheck, Target, TrendingDown } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import type { MomentBadges } from './badgeMoments';
import { momentMeta, momentState } from './badgeMoments';
import type { Profile } from './profile';
import type { PlayerKey } from './round';
import { BIRDIE_STREAK_MIN, PAR_STREAK_MIN, birdieStreakTier, parStreakTier, streakMeta, streakState } from './streaks';
import { colors, palette } from '../theme/tokens';

export type BadgeTier = 'legendary' | 'epic' | 'great';
export type BadgeState = 'earned' | 'pending' | 'locked';

export type TrophyBadge = {
  name: string;
  meta: string;
  icon: LucideIcon;
  tier: BadgeTier;
  state: BadgeState;
};

export const TIER_COLOR: Record<BadgeTier, string> = {
  legendary: colors.scoreEagle,
  epic: colors.accent,
  great: palette.green[700],
};

/** Lower rank = more prestigious — used to sort/pick a player's most-prized pins. */
export const TIER_RANK: Record<BadgeTier, number> = {
  legendary: 0,
  epic: 1,
  great: 2,
};

export type AcePinAward = { tier: BadgeTier; icon: LucideIcon };

/** Badges without their own detection logic yet — same for every viewer until each is wired to real data. */
const STATIC_BADGES: TrophyBadge[] = [
  { name: 'Broke 80', meta: 'Awaiting kaki', icon: Gauge, tier: 'epic', state: 'pending' },
  { name: 'Albatross', meta: 'Locked', icon: Target, tier: 'legendary', state: 'locked' },
  { name: 'Bogey-Free Nine', meta: 'Locked', icon: ShieldCheck, tier: 'legendary', state: 'locked' },
  { name: 'Broke 90', meta: 'Locked', icon: TrendingDown, tier: 'great', state: 'locked' },
];

/** Has any kaki attested each of the viewer's real badges yet — see src/data/attestations.ts. */
export type StreakAttestation = { birdieStreak: boolean; parStreak: boolean; holeInOne: boolean; eagle: boolean };

/** Hole-in-One / Eagle, built from a player's real badge_moments (see src/data/badgeMoments.ts) plus peer attestation status. */
function buildMomentBadges(moments: MomentBadges, attested: StreakAttestation): [TrophyBadge, TrophyBadge] {
  return [
    {
      name: 'Hole-in-One',
      meta: momentMeta(moments.hole_in_one, attested.holeInOne),
      icon: Target,
      tier: 'legendary',
      state: momentState(moments.hole_in_one, attested.holeInOne),
    },
    {
      name: 'Eagle',
      meta: momentMeta(moments.eagle, attested.eagle),
      icon: Bird,
      tier: 'epic',
      state: momentState(moments.eagle, attested.eagle),
    },
  ];
}

/** Birdie Streak / Par Streak, built from a player's real `birdieStreakBest`/`parStreakBest` (see src/data/streaks.ts) plus peer attestation status. */
function buildStreakBadges(profile: Pick<Profile, 'birdieStreakBest' | 'parStreakBest'> | null, attested: StreakAttestation): [TrophyBadge, TrophyBadge] {
  const birdieBest = profile?.birdieStreakBest ?? 0;
  const parBest = profile?.parStreakBest ?? 0;
  return [
    {
      name: 'Birdie Streak',
      meta: streakMeta(birdieBest, BIRDIE_STREAK_MIN, attested.birdieStreak),
      icon: Flame,
      tier: birdieStreakTier(birdieBest),
      state: streakState(birdieBest, BIRDIE_STREAK_MIN, attested.birdieStreak),
    },
    {
      name: 'Par Streak',
      meta: streakMeta(parBest, PAR_STREAK_MIN, attested.parStreak),
      icon: Repeat,
      tier: parStreakTier(parBest),
      state: streakState(parBest, PAR_STREAK_MIN, attested.parStreak),
    },
  ];
}

/** The full cabinet, in display order. `profile` null renders every real badge as locked (not yet loaded). */
export function buildTrophyBadges(
  profile: Pick<Profile, 'birdieStreakBest' | 'parStreakBest'> | null,
  attested: StreakAttestation,
  moments: MomentBadges,
): TrophyBadge[] {
  const [broke80, albatross, bogeyFreeNine, broke90] = STATIC_BADGES;
  const [holeInOne, eagle] = buildMomentBadges(moments, attested);
  const [birdieStreak, parStreak] = buildStreakBadges(profile, attested);
  return [holeInOne, eagle, birdieStreak, broke80!, albatross!, bogeyFreeNine!, parStreak, broke90!];
}

export type FeaturedBadgeAttestationType = 'hole_in_one' | 'eagle' | 'birdie_streak' | 'par_streak';

export type FeaturedBadge = {
  name: string;
  icon: LucideIcon;
  tier: BadgeTier;
  metaText: string;
  /** Which badge_attestations row backs this — the screen fetches real attester names for it (see src/data/attestations.ts's fetchAttesters). */
  attestationType: FeaturedBadgeAttestationType;
};

const FEATURED_ATTESTATION_TYPE: Partial<Record<string, FeaturedBadgeAttestationType>> = {
  'Hole-in-One': 'hole_in_one',
  Eagle: 'eagle',
  'Birdie Streak': 'birdie_streak',
  'Par Streak': 'par_streak',
};

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}

/**
 * The viewer's single best-tier earned badge, formatted for the Featured
 * Trophy Card — real course/hole/date for Hole-in-One/Eagle, real streak
 * length otherwise. Null if nothing's earned yet (Profile/Trophy Cabinet
 * fall back to the empty-cabinet nudge in that case) or if the best-earned
 * badge is one of the still-static ones (Broke 80/90 etc. never actually
 * reach 'earned' today, so this is just a defensive fallback).
 */
export function pickFeaturedBadge(trophyBadges: TrophyBadge[], moments: MomentBadges): FeaturedBadge | null {
  const best = [...trophyBadges].filter((b) => b.state === 'earned').sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier])[0];
  if (!best) return null;
  const attestationType = FEATURED_ATTESTATION_TYPE[best.name];
  if (!attestationType) return null;

  const moment = attestationType === 'hole_in_one' ? moments.hole_in_one : attestationType === 'eagle' ? moments.eagle : null;
  const metaText = moment ? `${moment.courseName} · hole ${moment.holeNumber} · ${formatShortDate(moment.achievedAt)}` : best.meta;

  return { name: best.name, icon: best.icon, tier: best.tier, metaText, attestationType };
}

export function trophyCounts(badges: TrophyBadge[]) {
  const earned = badges.filter((b) => b.state === 'earned').length;
  const locked = badges.filter((b) => b.state === 'locked').length;
  const gold = badges.filter((b) => b.tier === 'legendary' && b.state === 'earned').length;
  const total = badges.length;
  return { earned, locked, gold, total, progressPercent: total === 0 ? 0 : Math.round((earned / total) * 100) };
}

/**
 * Ace pins — the mini trophy medallions that ride beside a name on the
 * Leaderboard and in the Match Lobby. Dead code today (unused by any screen)
 * and still keyed off the static badges only — revisit once pins actually
 * ship somewhere.
 */
export const PLAYER_PINS: Record<PlayerKey, AcePinAward[]> = {
  A: [
    { tier: 'epic', icon: Bird },
    { tier: 'great', icon: Repeat },
  ],
  B: STATIC_BADGES.filter((b) => b.state === 'earned')
    .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier])
    .map((b) => ({ tier: b.tier, icon: b.icon })),
  C: [],
};

/** The shareable "brag card" artifact — same Hole-in-One moment as FEATURED_BADGE, with the extra context that card needs. */
export const BRAG_CARD = {
  name: 'Hole-in-One',
  icon: Target,
  tagline: 'Straight from the tee to the cup — the shot every golfer dreams about.',
  player: { name: 'Wei Liang', initials: 'WL', handicap: 7.0 },
  statValue: '1 stroke',
  statLabel: 'on a par 3',
  course: 'Tanah Merah',
  hole: '7th',
  date: 'Sat, 13 Jun',
  year: '2026',
  attestedBy: 'Marcus & Jun Long',
};
