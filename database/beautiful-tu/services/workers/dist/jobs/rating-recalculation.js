"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recalculateRatings = void 0;
const supabase_1 = require("../lib/supabase");
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createJobLogger)('rating-recalculation');
const GLICKO_TAU = 0.5;
const GLICKO_EPSILON = 0.000001;
const g = (phi) => 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI));
const E = (mu, muj, phij) => {
    return 1 / (1 + Math.exp(-g(phij) * (mu - muj)));
};
const calculateNewRating = (player, opponent, score) => {
    const mu = (player.rating - 1500) / 173.7178;
    const phi = player.deviation / 173.7178;
    const muj = (opponent.rating - 1500) / 173.7178;
    const phij = opponent.deviation / 173.7178;
    const gPhij = g(phij);
    const Emu = E(mu, muj, phij);
    const v = 1 / (gPhij * gPhij * Emu * (1 - Emu));
    const delta = v * gPhij * (score - Emu);
    let a = Math.log(player.volatility * player.volatility);
    const f = (x) => {
        const ex = Math.exp(x);
        const d2 = delta * delta;
        const p2 = phi * phi;
        return (ex * (d2 - p2 - v - ex)) / (2 * Math.pow(p2 + v + ex, 2)) - (x - a) / (GLICKO_TAU * GLICKO_TAU);
    };
    let A = a;
    let B;
    if (delta * delta > phi * phi + v) {
        B = Math.log(delta * delta - phi * phi - v);
    }
    else {
        let k = 1;
        while (f(a - k * GLICKO_TAU) < 0)
            k++;
        B = a - k * GLICKO_TAU;
    }
    let fA = f(A);
    let fB = f(B);
    while (Math.abs(B - A) > GLICKO_EPSILON) {
        const C = A + (A - B) * fA / (fB - fA);
        const fC = f(C);
        if (fC * fB <= 0) {
            A = B;
            fA = fB;
        }
        else {
            fA = fA / 2;
        }
        B = C;
        fB = fC;
    }
    const newVolatility = Math.exp(A / 2);
    const phiStar = Math.sqrt(phi * phi + newVolatility * newVolatility);
    const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
    const newMu = mu + newPhi * newPhi * gPhij * (score - Emu);
    return {
        rating: 173.7178 * newMu + 1500,
        deviation: 173.7178 * newPhi,
        volatility: newVolatility,
    };
};
const getTierFromRating = (rating) => {
    if (rating >= 2400)
        return 'master';
    if (rating >= 2100)
        return 'diamond';
    if (rating >= 1800)
        return 'platinum';
    if (rating >= 1500)
        return 'gold';
    if (rating >= 1200)
        return 'silver';
    if (rating >= 900)
        return 'bronze';
    return 'novice';
};
const recalculateRatings = async () => {
    log.info('Running rating recalculation');
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const { data: completedBattles, error } = await supabase_1.supabase
        .from('battles')
        .select('id, player1_id, player2_id, winner_id, rating_data')
        .eq('status', 'completed')
        .eq('battle_type', 'ranked')
        .gte('completed_at', yesterday)
        .is('rating_data', null);
    if (error) {
        log.error({ error }, 'Failed to fetch battles for rating calculation');
        return;
    }
    let processedCount = 0;
    for (const battle of completedBattles || []) {
        if (!battle.player1_id || !battle.player2_id || !battle.winner_id)
            continue;
        const [{ data: p1Rating }, { data: p2Rating }] = await Promise.all([
            supabase_1.supabase.from('user_ratings').select('*').eq('user_id', battle.player1_id).single(),
            supabase_1.supabase.from('user_ratings').select('*').eq('user_id', battle.player2_id).single(),
        ]);
        if (!p1Rating || !p2Rating)
            continue;
        const p1Score = battle.winner_id === battle.player1_id ? 1 : 0;
        const p2Score = 1 - p1Score;
        const newP1 = calculateNewRating({ rating: p1Rating.rating, deviation: p1Rating.deviation, volatility: p1Rating.volatility }, { rating: p2Rating.rating, deviation: p2Rating.deviation, volatility: p2Rating.volatility }, p1Score);
        const newP2 = calculateNewRating({ rating: p2Rating.rating, deviation: p2Rating.deviation, volatility: p2Rating.volatility }, { rating: p1Rating.rating, deviation: p1Rating.deviation, volatility: p1Rating.volatility }, p2Score);
        await Promise.all([
            supabase_1.supabase.from('user_ratings').update({
                rating: newP1.rating,
                deviation: newP1.deviation,
                volatility: newP1.volatility,
                tier: getTierFromRating(newP1.rating),
                wins: p1Score === 1 ? p1Rating.wins + 1 : p1Rating.wins,
                losses: p1Score === 0 ? p1Rating.losses + 1 : p1Rating.losses,
                streak: p1Score === 1 ? Math.max(1, p1Rating.streak + 1) : Math.min(-1, p1Rating.streak - 1),
                last_calculated: new Date().toISOString(),
            }).eq('user_id', battle.player1_id),
            supabase_1.supabase.from('user_ratings').update({
                rating: newP2.rating,
                deviation: newP2.deviation,
                volatility: newP2.volatility,
                tier: getTierFromRating(newP2.rating),
                wins: p2Score === 1 ? p2Rating.wins + 1 : p2Rating.wins,
                losses: p2Score === 0 ? p2Rating.losses + 1 : p2Rating.losses,
                streak: p2Score === 1 ? Math.max(1, p2Rating.streak + 1) : Math.min(-1, p2Rating.streak - 1),
                last_calculated: new Date().toISOString(),
            }).eq('user_id', battle.player2_id),
            supabase_1.supabase.from('battles').update({
                rating_data: {
                    p1_before: p1Rating.rating,
                    p1_after: newP1.rating,
                    p2_before: p2Rating.rating,
                    p2_after: newP2.rating,
                },
            }).eq('id', battle.id),
        ]);
        processedCount++;
    }
    log.info({ processedCount }, 'Rating recalculation complete');
};
exports.recalculateRatings = recalculateRatings;
//# sourceMappingURL=rating-recalculation.js.map