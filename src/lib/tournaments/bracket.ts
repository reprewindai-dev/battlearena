/**
 * Tournament bracket generation and management utilities.
 * Supports single elimination, double elimination (semi), round robin, swiss.
 */

export type BracketFormat = 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss';

export interface BracketParticipant {
  id: string;
  handle: string;
  display_name: string | null;
  seed: number;
  rating?: number;
}

export interface BracketMatch {
  id?: string;
  round: number;
  match_number: number;
  bracket_position: string;
  player_a_id: string | null;
  player_b_id: string | null;
  winner_id?: string | null;
  score_a?: number;
  score_b?: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'walkover';
  // For visualization
  player_a?: BracketParticipant | null;
  player_b?: BracketParticipant | null;
}

export interface Bracket {
  format: BracketFormat;
  rounds: number;
  matches: BracketMatch[];
}

/**
 * Pad participants to next power of 2 with byes (null player).
 */
function padToPowerOfTwo(participants: BracketParticipant[]): Array<BracketParticipant | null> {
  const n = participants.length;
  let size = 1;
  while (size < n) size *= 2;
  const padded: Array<BracketParticipant | null> = [...participants];
  while (padded.length < size) padded.push(null);
  return padded;
}

/**
 * Standard seeding order for single elimination (1v(n), 2v(n-1), etc.)
 */
function seededOrder(size: number): number[] {
  if (size === 1) return [0];
  const half = size / 2;
  const top = seededOrder(half);
  const bottom = seededOrder(half).map((i) => size - 1 - i);
  const result: number[] = [];
  for (let i = 0; i < half; i++) {
    result.push(top[i], bottom[i]);
  }
  return result;
}

/**
 * Generate a single-elimination bracket from a sorted (seeded) participant list.
 */
export function generateSingleElimination(participants: BracketParticipant[]): Bracket {
  const seeded = [...participants].sort((a, b) => a.seed - b.seed);
  const padded = padToPowerOfTwo(seeded);
  const size = padded.length;
  const totalRounds = Math.log2(size);
  const order = seededOrder(size);
  const reordered = order.map((i) => padded[i]);

  const matches: BracketMatch[] = [];

  // Round 1 - pair up participants
  const r1Pairs = Math.floor(reordered.length / 2);
  for (let i = 0; i < r1Pairs; i++) {
    const pa = reordered[i * 2];
    const pb = reordered[i * 2 + 1];
    const matchNum = i + 1;
    const pos = `R1M${matchNum}`;

    const match: BracketMatch = {
      round: 1,
      match_number: matchNum,
      bracket_position: pos,
      player_a_id: pa?.id ?? null,
      player_b_id: pb?.id ?? null,
      player_a: pa ?? null,
      player_b: pb ?? null,
      status: 'pending',
    };

    // Auto-walkover byes
    if (pa && !pb) {
      match.winner_id = pa.id;
      match.status = 'walkover';
    } else if (!pa && pb) {
      match.winner_id = pb.id;
      match.status = 'walkover';
    }

    matches.push(match);
  }

  // Subsequent rounds - placeholders
  let prevRoundMatches = r1Pairs;
  for (let round = 2; round <= totalRounds; round++) {
    const roundMatches = Math.floor(prevRoundMatches / 2);
    const roundLabel = getRoundLabel(round, totalRounds);
    for (let m = 1; m <= roundMatches; m++) {
      matches.push({
        round,
        match_number: m,
        bracket_position: `${roundLabel}${m}`,
        player_a_id: null,
        player_b_id: null,
        status: 'pending',
      });
    }
    prevRoundMatches = roundMatches;
  }

  return {
    format: 'single_elimination',
    rounds: totalRounds,
    matches,
  };
}

function getRoundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'F';
  if (fromEnd === 1) return 'SF';
  if (fromEnd === 2) return 'QF';
  return `R${round}M`;
}

/**
 * Generate round-robin: every participant plays everyone else once.
 */
export function generateRoundRobin(participants: BracketParticipant[]): Bracket {
  const n = participants.length;
  const matches: BracketMatch[] = [];
  let matchNum = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      matchNum++;
      matches.push({
        round: 1,
        match_number: matchNum,
        bracket_position: `RR${matchNum}`,
        player_a_id: participants[i].id,
        player_b_id: participants[j].id,
        player_a: participants[i],
        player_b: participants[j],
        status: 'pending',
      });
    }
  }

  return {
    format: 'round_robin',
    rounds: 1,
    matches,
  };
}

/**
 * Main entry point: generate bracket based on format.
 */
export function generateBracket(
  format: BracketFormat,
  participants: BracketParticipant[]
): Bracket {
  switch (format) {
    case 'single_elimination':
    case 'double_elimination':
      return generateSingleElimination(participants);
    case 'round_robin':
      return generateRoundRobin(participants);
    case 'swiss':
      return generateSingleElimination(participants); // Swiss uses SE structure initially
    default:
      return generateSingleElimination(participants);
  }
}

/**
 * Calculate prize distribution based on prize pool and participant count.
 * Standard split: 1st 50%, 2nd 25%, 3rd-4th 12.5% each.
 */
export function calculatePrizes(prizePool: number, participantCount: number): Record<number, number> {
  const prizes: Record<number, number> = {};
  if (prizePool <= 0) return prizes;

  if (participantCount >= 4) {
    prizes[1] = Math.floor(prizePool * 0.5);
    prizes[2] = Math.floor(prizePool * 0.25);
    prizes[3] = Math.floor(prizePool * 0.125);
    prizes[4] = prizePool - prizes[1] - prizes[2] - prizes[3];
  } else if (participantCount === 3) {
    prizes[1] = Math.floor(prizePool * 0.6);
    prizes[2] = Math.floor(prizePool * 0.3);
    prizes[3] = prizePool - prizes[1] - prizes[2];
  } else if (participantCount === 2) {
    prizes[1] = Math.floor(prizePool * 0.7);
    prizes[2] = prizePool - prizes[1];
  } else {
    prizes[1] = prizePool;
  }

  return prizes;
}

/**
 * Organize matches by round for visualization.
 */
export function organizeByRound(matches: BracketMatch[]): Map<number, BracketMatch[]> {
  const byRound = new Map<number, BracketMatch[]>();
  for (const match of matches) {
    const list = byRound.get(match.round) ?? [];
    list.push(match);
    byRound.set(match.round, list);
  }
  return byRound;
}
