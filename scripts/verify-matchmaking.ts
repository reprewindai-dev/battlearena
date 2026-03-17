#!/usr/bin/env node

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.production" });
config({ path: ".env.local" });
config();

type TestUser = { id: string; email: string; username: string };

const TEST_USERS: TestUser[] = [
  { id: "00000000-0000-0000-0000-000000000101", email: "verify1@battlearena.local", username: "verify_user_1" },
  { id: "00000000-0000-0000-0000-000000000102", email: "verify2@battlearena.local", username: "verify_user_2" },
  { id: "00000000-0000-0000-0000-000000000103", email: "verify3@battlearena.local", username: "verify_user_3" },
];

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing_env:${name}`);
  }
  return value;
}

class MatchmakingVerifier {
  private readonly adminClient = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
  );

  private async seedUsers() {
    const { error } = await this.adminClient.from("users").upsert(TEST_USERS, { onConflict: "id" });
    if (error) throw new Error(`seed_users_failed:${error.message}`);
  }

  private async cleanup() {
    const testUserIds = TEST_USERS.map((u) => u.id);

    await this.adminClient
      .from("matchmaking_queue")
      .delete()
      .in("user_id", testUserIds);

    const { data: participantBattles } = await this.adminClient
      .from("battle_participants")
      .select("battle_id")
      .in("user_id", testUserIds);

    const battleIdsFromParticipants = Array.from(
      new Set((participantBattles ?? []).map((row) => row.battle_id as string).filter(Boolean)),
    );

    if (battleIdsFromParticipants.length > 0) {
      await this.adminClient.from("battle_participants").delete().in("battle_id", battleIdsFromParticipants);
      await this.adminClient.from("battles").delete().in("id", battleIdsFromParticipants);
    }

    await this.adminClient.from("battles").delete().in("created_by", testUserIds);
  }

  private async verifyQueueContract() {
    const now = Date.now();

    const payload = TEST_USERS.slice(0, 2).map((user, index) => ({
      user_id: user.id,
      queue_type: "freestyle",
      mode: "freestyle",
      battle_format: "60s",
      status: "active",
      preferred_genres: ["freestyle"],
      created_at: new Date(now + index * 1000).toISOString(),
      expires_at: new Date(now + 10 * 60 * 1000).toISOString(),
      idempotency_key: `verify_queue_${user.id}_${now}`,
    }));

    const { error: insertError } = await this.adminClient.from("matchmaking_queue").insert(payload);
    if (insertError) throw new Error(`queue_insert_failed:${insertError.message}`);

    const { data: queued, error: queuedError } = await this.adminClient
      .from("matchmaking_queue")
      .select("id,user_id,queue_type,mode,status,battle_format,created_at,expires_at")
      .eq("queue_type", "freestyle")
      .eq("status", "active")
      .in("user_id", TEST_USERS.slice(0, 2).map((u) => u.id))
      .order("created_at", { ascending: true });

    if (queuedError) throw new Error(`queue_read_failed:${queuedError.message}`);
    if (!queued || queued.length !== 2) {
      throw new Error(`queue_count_mismatch:${queued?.length ?? 0}`);
    }
  }

  private async verifyHumanMatchLifecycle() {
    const { data: queueRows, error: queueError } = await this.adminClient
      .from("matchmaking_queue")
      .select("id,user_id,battle_format,queue_type")
      .eq("status", "active")
      .eq("queue_type", "freestyle")
      .in("user_id", TEST_USERS.slice(0, 2).map((u) => u.id))
      .order("created_at", { ascending: true })
      .limit(2);

    if (queueError) throw new Error(`queue_lookup_failed:${queueError.message}`);
    if (!queueRows || queueRows.length < 2) throw new Error("not_enough_users_for_human_match");

    const [a, b] = queueRows;

    const { data: battle, error: battleError } = await this.adminClient
      .from("battles")
      .insert({
        created_by: a.user_id,
        participant_1_id: a.user_id,
        participant_2_id: b.user_id,
        battle_type: "casual",
        format: "60s",
        status: "matched",
        room_code: `VR${Date.now()}`.slice(0, 10),
        is_bot_battle: false,
        fallback_reason: "none",
        wait_time_ms: 0,
      })
      .select("id")
      .single();

    if (battleError || !battle?.id) throw new Error(`battle_create_failed:${battleError?.message ?? "unknown"}`);

    const { error: participantsError } = await this.adminClient.from("battle_participants").insert([
      { battle_id: battle.id, user_id: a.user_id, slot: 1 },
      { battle_id: battle.id, user_id: b.user_id, slot: 2 },
    ]);
    if (participantsError) throw new Error(`participants_insert_failed:${participantsError.message}`);

    const { error: queueUpdateError } = await this.adminClient
      .from("matchmaking_queue")
      .update({ status: "matched", battle_id: battle.id, matched_at: new Date().toISOString() })
      .in("id", [a.id, b.id]);
    if (queueUpdateError) throw new Error(`queue_update_failed:${queueUpdateError.message}`);
  }

  private async verifyBotFallbackMetadata() {
    const now = Date.now();
    const user = TEST_USERS[2];

    const { error: enqueueError } = await this.adminClient.from("matchmaking_queue").insert({
      user_id: user.id,
      queue_type: "ranked",
      mode: "ranked",
      battle_format: "60s",
      status: "active",
      preferred_genres: ["battle-rap"],
      created_at: new Date(now - 46_000).toISOString(),
      expires_at: new Date(now + 9 * 60 * 1000).toISOString(),
      idempotency_key: `verify_ranked_${now}`,
    });
    if (enqueueError) throw new Error(`ranked_enqueue_failed:${enqueueError.message}`);

    const { data: botBattle, error: botBattleError } = await this.adminClient
      .from("battles")
      .insert({
        created_by: user.id,
        participant_1_id: user.id,
        battle_type: "ranked",
        format: "60s",
        status: "matched",
        room_code: `VB${now}`.slice(0, 10),
        is_bot_battle: true,
        bot_personality_id: "adaptive_lyricist",
        bot_difficulty: "hard",
        fallback_reason: "timed_bot_fallback",
        wait_time_ms: 46_000,
        mmr_neutral: true,
      })
      .select("id,is_bot_battle,fallback_reason,wait_time_ms,mmr_neutral")
      .single();

    if (botBattleError || !botBattle?.id) {
      throw new Error(`bot_battle_create_failed:${botBattleError?.message ?? "unknown"}`);
    }

    if (!botBattle.is_bot_battle || botBattle.fallback_reason !== "timed_bot_fallback" || !botBattle.mmr_neutral) {
      throw new Error("bot_metadata_contract_failed");
    }
  }

  private async verifyCleanupRpc() {
    const { data, error } = await this.adminClient.rpc("cleanup_expired_queue");
    if (error) throw new Error(`cleanup_rpc_failed:${error.message}`);
    if (typeof data !== "number") throw new Error("cleanup_rpc_invalid_return_type");
  }

  private async verifyCleanupCronSchedule() {
    const { data, error } = await this.adminClient.rpc("has_cleanup_expired_queue_cron_job");
    if (error) {
      throw new Error(`cron_job_lookup_failed:${error.message}`);
    }
    if (data !== true) {
      throw new Error("cron_job_missing:cleanup_expired_matchmaking_queue");
    }
  }

  async run() {
    let passed = 0;
    let failed = 0;
    const errors: string[] = [];

    const runStep = async (name: string, fn: () => Promise<void>) => {
      try {
        await fn();
        passed += 1;
        console.log(`PASS ${name}`);
      } catch (error: unknown) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${name}: ${message}`);
        console.log(`FAIL ${name}: ${message}`);
      }
    };

    console.log("Matchmaking System Verification");
    console.log("=====================================");

    await this.seedUsers();
    await this.cleanup();

    await runStep("Queue Contract", () => this.verifyQueueContract());
    await runStep("Human Match Lifecycle", () => this.verifyHumanMatchLifecycle());
    await runStep("Timed Bot Fallback Metadata", () => this.verifyBotFallbackMetadata());
    await runStep("Cleanup RPC", () => this.verifyCleanupRpc());
    await runStep("Cleanup Cron Schedule", () => this.verifyCleanupCronSchedule());

    await this.cleanup();

    console.log("=====================================");
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    if (errors.length > 0) {
      console.log("Errors:");
      errors.forEach((error) => console.log(` - ${error}`));
      process.exitCode = 1;
      return;
    }

    console.log("Matchmaking verification passed");
  }
}

new MatchmakingVerifier()
  .run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });

