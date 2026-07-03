import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { GROSS, HOLES, STAKE, buildFrontNineDeals } from '../data/round';
import type { PlayerKey, StrokeDeal } from '../data/round';

type GrossMap = Record<PlayerKey, number[]>;

type RoundContextValue = {
  /** Live hole-by-hole gross scores, shared by every screen in the round flow. */
  gross: GrossMap;
  /** Holes played so far (1-18) — the match's shared live progress. */
  thru: number;
  /** Front-9 stroke deals agreed in the Match Lobby. */
  frontNineDeals: StrokeDeal[];
  /** Dollars at stake per hole, set in the Match Lobby. */
  stakePerHole: number;
  adjustScore: (playerKey: PlayerKey, holeIndex: number, delta: number) => void;
  setThru: (thru: number) => void;
  setFrontNineDeals: (deals: StrokeDeal[]) => void;
  setStakePerHole: (stake: number) => void;
};

const RoundContext = createContext<RoundContextValue | null>(null);

export function RoundProvider({ children }: { children: ReactNode }) {
  const [gross, setGross] = useState<GrossMap>(GROSS);
  const [thru, setThru] = useState(6);
  const [frontNineDeals, setFrontNineDeals] = useState<StrokeDeal[]>(() => buildFrontNineDeals());
  const [stakePerHole, setStakePerHole] = useState(STAKE);

  const adjustScore = useCallback((playerKey: PlayerKey, holeIndex: number, delta: number) => {
    setGross((prev) => {
      const next = { ...prev, [playerKey]: prev[playerKey].slice() };
      next[playerKey][holeIndex] = Math.max(1, next[playerKey][holeIndex] + delta);
      return next;
    });
  }, []);

  const value = useMemo<RoundContextValue>(
    () => ({ gross, thru, frontNineDeals, stakePerHole, adjustScore, setThru, setFrontNineDeals, setStakePerHole }),
    [gross, thru, frontNineDeals, stakePerHole, adjustScore],
  );

  return <RoundContext.Provider value={value}>{children}</RoundContext.Provider>;
}

export function useRound(): RoundContextValue {
  const ctx = useContext(RoundContext);
  if (!ctx) throw new Error('useRound must be used within a RoundProvider');
  return ctx;
}

/** Finish/Recap always represent the completed round, regardless of live mid-round progress. */
export const FULL_ROUND_THRU = HOLES.length;
