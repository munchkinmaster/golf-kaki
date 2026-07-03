import { Bird, Flame, Gauge, Mountain, Repeat, ShieldCheck, Target, TrendingDown } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import type { PlayerKey } from './round';
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

export const FEATURED_BADGE = {
  name: 'Hole-in-One',
  icon: Target,
  location: 'Tanah Merah · 7th · 2 weeks ago',
  attestedBy: 'Marcus & Jun Long',
};

export const TROPHY_BADGES: TrophyBadge[] = [
  { name: 'Hole-in-One', meta: 'Tanah Merah', icon: Target, tier: 'legendary', state: 'earned' },
  { name: 'Eagle', meta: 'Sentosa', icon: Bird, tier: 'epic', state: 'earned' },
  { name: 'Birdie Streak', meta: '3 in a row', icon: Flame, tier: 'epic', state: 'earned' },
  { name: 'Broke 80', meta: 'Awaiting kaki', icon: Gauge, tier: 'epic', state: 'pending' },
  { name: 'Albatross', meta: 'Locked', icon: Target, tier: 'legendary', state: 'locked' },
  { name: 'Bogey-Free Nine', meta: 'Locked', icon: ShieldCheck, tier: 'legendary', state: 'locked' },
  { name: 'Par Streak', meta: 'Locked', icon: Repeat, tier: 'great', state: 'locked' },
  { name: 'Broke 90', meta: 'Locked', icon: TrendingDown, tier: 'great', state: 'locked' },
  { name: 'Sandie', meta: 'Locked', icon: Mountain, tier: 'great', state: 'locked' },
];

/**
 * Ace pins — the mini trophy medallions that ride beside a name on the
 * Leaderboard and in the Match Lobby. Wei Liang's (the viewer) pins mirror
 * their earned trophy cabinet; the other kaki are flavor data since their
 * cabinets aren't modeled yet.
 */
export const PLAYER_PINS: Record<PlayerKey, AcePinAward[]> = {
  A: [
    { tier: 'epic', icon: Bird },
    { tier: 'great', icon: Repeat },
  ],
  B: TROPHY_BADGES.filter((b) => b.state === 'earned')
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

export const TROPHIES_EARNED = TROPHY_BADGES.filter((b) => b.state === 'earned').length;
export const TROPHIES_LOCKED = TROPHY_BADGES.filter((b) => b.state === 'locked').length;
export const GOLD_TROPHIES = TROPHY_BADGES.filter((b) => b.tier === 'legendary' && b.state === 'earned').length;
// Spec copy reads "3 / 8" / "38%" — the cabinet grid itself lists 9 badges (the
// featured one is shown twice, once pinned and once in the grid).
export const TROPHIES_GOAL = 8;
export const PROGRESS_PERCENT = 38;
