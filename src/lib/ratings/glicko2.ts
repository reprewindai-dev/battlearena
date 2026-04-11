/**
 * Glicko-2 Rating System Implementation
 * Based on Mark Glickman's Glicko-2 algorithm: http://www.glicko.net/glicko/glicko2.pdf
 */

const GLICKO2_SCALE = 173.7178;

export interface Glicko2Player {
  rating: number;       // Glicko-1 scale (default 1500)
  rd: number;           // Rating deviation (default 350)
  volatility: number;   // Volatility (default 0.06)
}

export interface Glicko2Result {
  opponent: Glicko2Player;
  score: number;        // 1 = win, 0.5 = draw, 0 = loss
}

export interface Glicko2Updated extends Glicko2Player {
  tierChanged: boolean;
  previousTier: string;
  newTier: string;
}

function toGlicko2Scale(player: Glicko2Player) {
  return {
    mu: (player.rating - 1500) / GLICKO2_SCALE,
    phi: player.rd / GLICKO2_SCALE,
    sigma: player.volatility,
  };
}

function fromGlicko2Scale(mu: number, phi: number, sigma: number): Glicko2Player {
  return {
    rating: Math.round(mu * GLICKO2_SCALE + 1500),
    rd: Math.round(phi * GLICKO2_SCALE),
    volatility: sigma,
  };
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

function computeVariance(mu: number, opponents: Array<{ mu: number; phi: number; score: number }>): number {
  let sum = 0;
  for (const opp of opponents) {
    const gPhi = g(opp.phi);
    const e = E(mu, opp.mu, opp.phi);
    sum += gPhi * gPhi * e * (1 - e);
  }
  return sum === 0 ? Infinity : 1 / sum;
}

function computeDelta(
  mu: number,
  v: number,
  opponents: Array<{ mu: number; phi: number; score: number }>
): number {
  let sum = 0;
  for (const opp of opponents) {
    const gPhi = g(opp.phi);
    const e = E(mu, opp.mu, opp.phi);
    sum += gPhi * (opp.score - e);
  }
  return v * sum;
}

function computeNewSigma(phi: number, sigma: number, delta: number, v: number): number {
  const TAU = 0.5;
  const EPSILON = 0.000001;
  const a = Math.log(sigma * sigma);

  function f(x: number): number {
    const ex = Math.exp(x);
    const phi2 = phi * phi;
    const num = ex * (delta * delta - phi2 - v - ex);
    const den = 2 * (phi2 + v + ex) * (phi2 + v + ex);
    return num / den - (x - a) / (TAU * TAU);
  }

  let A = a;
  let B: number;

  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);

  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

/**
 * Update a player's Glicko-2 rating after a rating period.
 * Pass an empty results array to decay RD (rating period with no games).
 */
export function updateRating(player: Glicko2Player, results: Glicko2Result[]): Glicko2Player {
  const { mu, phi, sigma } = toGlicko2Scale(player);

  if (results.length === 0) {
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return fromGlicko2Scale(mu, phiStar, sigma);
  }

  const opponents = results.map((r) => {
    const opp = toGlicko2Scale(r.opponent);
    return { mu: opp.mu, phi: opp.phi, score: r.score };
  });

  const v = computeVariance(mu, opponents);
  const delta = computeDelta(mu, v, opponents);
  const newSigma = computeNewSigma(phi, sigma, delta, v);
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  let newMu = mu;
  for (const opp of opponents) {
    newMu += newPhi * newPhi * g(opp.phi) * (opp.score - E(mu, opp.mu, opp.phi));
  }

  return fromGlicko2Scale(newMu, newPhi, newSigma);
}

// ============================================================
// Tier system based on rating
// ============================================================

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legend';

export interface TierInfo {
  tier: Tier;
  label: string;
  minRating: number;
  maxRating: number;
  color: string;
  nextTier: Tier | null;
  pointsToNext: number | null;
}

const TIER_THRESHOLDS: Array<{ tier: Tier; label: string; min: number; color: string }> = [
  { tier: 'bronze',   label: 'Bronze',   min: 0,    color: 'text-amber-600' },
  { tier: 'silver',   label: 'Silver',   min: 1200, color: 'text-slate-400' },
  { tier: 'gold',     label: 'Gold',     min: 1400, color: 'text-yellow-400' },
  { tier: 'platinum', label: 'Platinum', min: 1600, color: 'text-cyan-400' },
  { tier: 'diamond',  label: 'Diamond',  min: 1800, color: 'text-blue-400' },
  { tier: 'legend',   label: 'Legend',   min: 2000, color: 'text-purple-400' },
];

export function getTierForRating(rating: number): Tier {
  let tier: Tier = 'bronze';
  for (const threshold of TIER_THRESHOLDS) {
    if (rating >= threshold.min) tier = threshold.tier;
    else break;
  }
  return tier;
}

export function getTierInfo(rating: number): TierInfo {
  const tier = getTierForRating(rating);
  const idx = TIER_THRESHOLDS.findIndex((t) => t.tier === tier);
  const current = TIER_THRESHOLDS[idx];
  const next = idx + 1 < TIER_THRESHOLDS.length ? TIER_THRESHOLDS[idx + 1] : null;
  return {
    tier,
    label: current.label,
    minRating: current.min,
    maxRating: next ? next.min - 1 : 9999,
    color: current.color,
    nextTier: next?.tier ?? null,
    pointsToNext: next ? next.min - rating : null,
  };
}

export const DEFAULT_PLAYER: Glicko2Player = {
  rating: 1500,
  rd: 350,
  volatility: 0.06,
};

/**
 * Quick helper: update two players after a 1v1 match.
 * Returns { winner, loser } with updated ratings.
 */
export function resolveMatch(
  winner: Glicko2Player,
  loser: Glicko2Player
): { winner: Glicko2Player; loser: Glicko2Player } {
  const updatedWinner = updateRating(winner, [{ opponent: loser, score: 1 }]);
  const updatedLoser = updateRating(loser, [{ opponent: winner, score: 0 }]);
  return { winner: updatedWinner, loser: updatedLoser };
}
