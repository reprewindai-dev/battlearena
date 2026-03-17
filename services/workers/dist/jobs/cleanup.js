"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAllCleanupTasks = exports.cleanupAbandonedBattles = exports.cleanupOldModerationFlags = exports.cleanupExpiredTokens = exports.cleanupStaleRecordings = void 0;
const supabase_1 = require("../lib/supabase");
const logger_1 = require("../lib/logger");
const config_1 = require("../config");
const log = (0, logger_1.createJobLogger)('cleanup');
const cleanupStaleRecordings = async () => {
    log.info('Running stale recording cleanup');
    const cutoffDate = new Date(Date.now() - config_1.config.thresholds.staleRecordingDays * 86400000).toISOString();
    const { data: staleRounds, error } = await supabase_1.supabase
        .from('battle_rounds')
        .select('id, audio_url')
        .lt('created_at', cutoffDate)
        .not('audio_url', 'is', null);
    if (error) {
        log.error({ error }, 'Failed to fetch stale recordings');
        return;
    }
    let deletedCount = 0;
    for (const round of staleRounds || []) {
        if (round.audio_url) {
            const path = round.audio_url.split('/').pop();
            if (path) {
                await supabase_1.supabase.storage.from('battle-recordings').remove([path]);
                deletedCount++;
            }
        }
    }
    log.info({ deletedCount, totalStale: staleRounds?.length || 0 }, 'Stale recordings cleaned up');
};
exports.cleanupStaleRecordings = cleanupStaleRecordings;
const cleanupExpiredTokens = async () => {
    log.info('Running expired token cleanup');
    const { error, count } = await supabase_1.supabase
        .from('auth_tokens')
        .delete({ count: 'exact' })
        .lt('expires_at', new Date().toISOString());
    if (error) {
        log.error({ error }, 'Failed to cleanup expired tokens');
        return;
    }
    log.info({ deletedCount: count }, 'Expired tokens cleaned up');
};
exports.cleanupExpiredTokens = cleanupExpiredTokens;
const cleanupOldModerationFlags = async () => {
    log.info('Running old moderation flags cleanup');
    const cutoffDate = new Date(Date.now() - 90 * 86400000).toISOString();
    const { error, count } = await supabase_1.supabase
        .from('ai_moderation_flags')
        .delete({ count: 'exact' })
        .in('status', ['approved', 'dismissed'])
        .lt('created_at', cutoffDate);
    if (error) {
        log.error({ error }, 'Failed to cleanup old moderation flags');
        return;
    }
    log.info({ deletedCount: count }, 'Old moderation flags cleaned up');
};
exports.cleanupOldModerationFlags = cleanupOldModerationFlags;
const cleanupAbandonedBattles = async () => {
    log.info('Running abandoned battles cleanup');
    const cutoffDate = new Date(Date.now() - 24 * 3600000).toISOString();
    const { error, count } = await supabase_1.supabase
        .from('battles')
        .update({ status: 'cancelled' }, { count: 'exact' })
        .eq('status', 'pending')
        .lt('created_at', cutoffDate);
    if (error) {
        log.error({ error }, 'Failed to cleanup abandoned battles');
        return;
    }
    log.info({ cancelledCount: count }, 'Abandoned battles cancelled');
};
exports.cleanupAbandonedBattles = cleanupAbandonedBattles;
const runAllCleanupTasks = async () => {
    await (0, exports.cleanupStaleRecordings)();
    await (0, exports.cleanupExpiredTokens)();
    await (0, exports.cleanupOldModerationFlags)();
    await (0, exports.cleanupAbandonedBattles)();
    log.info('All cleanup tasks completed');
};
exports.runAllCleanupTasks = runAllCleanupTasks;
//# sourceMappingURL=cleanup.js.map