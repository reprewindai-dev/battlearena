"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.progressTournaments = void 0;
const supabase_1 = require("../lib/supabase");
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createJobLogger)('tournament-processor');
const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};
const progressTournaments = async () => {
    log.info('Processing tournament progression');
    const { data: activeTournaments } = await supabase_1.supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'active');
    for (const tournament of activeTournaments || []) {
        await checkAndProgressBracket(tournament.id);
    }
    await openRegistrations();
    await startScheduledTournaments();
    await completeTournaments();
    log.info({ count: activeTournaments?.length || 0 }, 'Tournament progression complete');
};
exports.progressTournaments = progressTournaments;
const checkAndProgressBracket = async (tournamentId) => {
    const { data: pendingMatches } = await supabase_1.supabase
        .from('tournament_brackets')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('status', 'pending')
        .not('player1_id', 'is', null)
        .not('player2_id', 'is', null);
    for (const match of pendingMatches || []) {
        if (!match.battle_id) {
            const { data: battle } = await supabase_1.supabase.from('battles').insert({
                tournament_id: tournamentId,
                battle_type: 'tournament',
                format: '60s',
                status: 'pending',
                player1_id: match.player1_id,
                player2_id: match.player2_id,
                room_code: generateRoomCode(),
            }).select().single();
            if (battle) {
                await supabase_1.supabase.from('tournament_brackets').update({
                    battle_id: battle.id,
                    status: 'scheduled',
                }).eq('id', match.id);
            }
        }
    }
    const { data: completedMatches } = await supabase_1.supabase
        .from('tournament_brackets')
        .select('id, round_number, match_number, battle_id')
        .eq('tournament_id', tournamentId)
        .eq('status', 'scheduled');
    for (const match of completedMatches || []) {
        if (!match.battle_id)
            continue;
        const { data: battle } = await supabase_1.supabase
            .from('battles')
            .select('winner_id')
            .eq('id', match.battle_id)
            .eq('status', 'completed')
            .single();
        if (battle?.winner_id) {
            await supabase_1.supabase.from('tournament_brackets').update({
                winner_id: battle.winner_id,
                status: 'completed',
            }).eq('id', match.id);
            await advanceWinner(tournamentId, match.round_number, match.match_number, battle.winner_id);
        }
    }
};
const advanceWinner = async (tournamentId, currentRound, currentMatch, winnerId) => {
    const nextRound = currentRound + 1;
    const nextMatch = Math.floor(currentMatch / 2);
    const isPlayer1 = currentMatch % 2 === 0;
    const { data: nextBracket } = await supabase_1.supabase
        .from('tournament_brackets')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('round_number', nextRound)
        .eq('match_number', nextMatch)
        .single();
    if (nextBracket) {
        const updateField = isPlayer1 ? 'player1_id' : 'player2_id';
        await supabase_1.supabase.from('tournament_brackets').update({
            [updateField]: winnerId,
        }).eq('id', nextBracket.id);
    }
};
const openRegistrations = async () => {
    const now = new Date().toISOString();
    const { data: toOpen } = await supabase_1.supabase
        .from('tournaments')
        .select('id')
        .eq('status', 'upcoming')
        .lte('registration_opens', now);
    for (const tournament of toOpen || []) {
        await supabase_1.supabase.from('tournaments').update({ status: 'registration' }).eq('id', tournament.id);
        log.info({ tournamentId: tournament.id }, 'Tournament registration opened');
    }
};
const startScheduledTournaments = async () => {
    const now = new Date().toISOString();
    const { data: toStart } = await supabase_1.supabase
        .from('tournaments')
        .select('id, max_participants')
        .eq('status', 'registration')
        .lte('starts_at', now);
    for (const tournament of toStart || []) {
        const { count } = await supabase_1.supabase
            .from('tournament_participants')
            .select('id', { count: 'exact' })
            .eq('tournament_id', tournament.id)
            .eq('status', 'registered');
        if ((count || 0) >= 2) {
            await generateBrackets(tournament.id);
            await supabase_1.supabase.from('tournaments').update({ status: 'active' }).eq('id', tournament.id);
            log.info({ tournamentId: tournament.id, participants: count }, 'Tournament started');
        }
    }
};
const generateBrackets = async (tournamentId) => {
    const { data: participants } = await supabase_1.supabase
        .from('tournament_participants')
        .select('user_id')
        .eq('tournament_id', tournamentId)
        .eq('status', 'registered')
        .order('registered_at');
    if (!participants || participants.length < 2)
        return;
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const numRounds = Math.ceil(Math.log2(shuffled.length));
    for (let round = 0; round < numRounds; round++) {
        const matchesInRound = Math.pow(2, numRounds - round - 1);
        for (let match = 0; match < matchesInRound; match++) {
            const bracket = {
                tournament_id: tournamentId,
                round_number: round,
                match_number: match,
                status: 'pending',
            };
            if (round === 0) {
                const p1Index = match * 2;
                const p2Index = match * 2 + 1;
                if (p1Index < shuffled.length)
                    bracket.player1_id = shuffled[p1Index].user_id;
                if (p2Index < shuffled.length)
                    bracket.player2_id = shuffled[p2Index].user_id;
            }
            await supabase_1.supabase.from('tournament_brackets').insert(bracket);
        }
    }
};
const completeTournaments = async () => {
    const { data: activeTournaments } = await supabase_1.supabase
        .from('tournaments')
        .select('id')
        .eq('status', 'active');
    for (const tournament of activeTournaments || []) {
        const { data: finalMatch } = await supabase_1.supabase
            .from('tournament_brackets')
            .select('winner_id')
            .eq('tournament_id', tournament.id)
            .order('round_number', { ascending: false })
            .limit(1)
            .single();
        if (finalMatch?.winner_id) {
            await supabase_1.supabase.from('tournaments').update({
                status: 'completed',
                ends_at: new Date().toISOString(),
            }).eq('id', tournament.id);
            await supabase_1.supabase.from('tournament_participants').update({
                status: 'winner',
            }).eq('tournament_id', tournament.id).eq('user_id', finalMatch.winner_id);
            log.info({ tournamentId: tournament.id, winnerId: finalMatch.winner_id }, 'Tournament completed');
        }
    }
};
//# sourceMappingURL=tournament-processor.js.map