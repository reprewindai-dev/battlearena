import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

type Credentials = {
  id: string;
  email: string;
  password: string;
};

type MatchmakingBody = {
  ok: true;
  mode: "freestyle" | "ranked" | "tournament";
  status: "queued" | "matched" | "none";
  matched: boolean;
  battleId: string | null;
  isBotBattle: boolean;
  fallbackReason: "none" | "timed_bot_fallback";
  waitTimeMs: number;
  queueType: "freestyle" | "ranked" | "tournament";
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasAdminEnv = Boolean(supabaseUrl && serviceRoleKey);

const adminClient = hasAdminEnv
  ? createClient(supabaseUrl as string, serviceRoleKey as string)
  : null;

const createdUserIds: string[] = [];
const createdBattleIds = new Set<string>();

function requireAdminClient() {
  if (!adminClient) {
    throw new Error("matchmaking_bot_env_missing");
  }
  return adminClient;
}

function randomSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

async function createVerifiedUser(prefix: string): Promise<Credentials> {
  const client = requireAdminClient();
  const email = `${prefix}_${randomSuffix()}@battlearena-e2e.local`;
  const password = `E2E_${randomSuffix()}_Strong!`;

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`failed_to_create_bot_user:${error?.message ?? "unknown"}`);
  }

  createdUserIds.push(data.user.id);
  return { id: data.user.id, email, password };
}

async function login(page: Page, credentials: Credentials) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 10000 });
}

async function ageActiveQueueEntry(userId: string, queueType: "freestyle" | "ranked", ageMs: number) {
  const client = requireAdminClient();
  const agedCreatedAt = new Date(Date.now() - ageMs).toISOString();

  const { data: queueRow, error: queueLookupError } = await client
    .from("matchmaking_queue")
    .select("id")
    .eq("user_id", userId)
    .eq("queue_type", queueType)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (queueLookupError) {
    throw new Error(`queue_lookup_failed:${queueLookupError.message}`);
  }

  if (!queueRow?.id) {
    throw new Error("queue_row_missing");
  }

  const { error: queueUpdateError } = await client
    .from("matchmaking_queue")
    .update({ created_at: agedCreatedAt })
    .eq("id", queueRow.id);

  if (queueUpdateError) {
    throw new Error(`queue_age_update_failed:${queueUpdateError.message}`);
  }
}

async function fetchBotBattleMetadata(battleId: string) {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("battles")
    .select("id,queue_type,battle_type,is_bot_battle,mmr_neutral,fallback_reason,wait_time_ms,bot_personality_id,bot_difficulty")
    .eq("id", battleId)
    .single();

  if (error || !data) {
    throw new Error(`battle_metadata_lookup_failed:${error?.message ?? "unknown"}`);
  }

  return data;
}

test.afterAll(async () => {
  if (!adminClient) return;

  if (createdBattleIds.size > 0) {
    const battleIds = Array.from(createdBattleIds);
    await adminClient.from("battle_participants").delete().in("battle_id", battleIds);
    await adminClient.from("battles").delete().in("id", battleIds);
  }

  if (createdUserIds.length > 0) {
    await adminClient.from("matchmaking_queue").delete().in("user_id", createdUserIds);
    await adminClient.from("users").delete().in("id", createdUserIds);

    for (const userId of createdUserIds) {
      await adminClient.auth.admin.deleteUser(userId);
    }
  }
});

test.describe("bot fallback verification", () => {
  test.skip(!hasAdminEnv, "Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

  test("freestyle queue falls back to a bot with auditable metadata", async ({ browser }) => {
    const user = await createVerifiedUser("bot_freestyle");
    const context = await browser.newContext();
    const page = await context.newPage();

    await login(page, user);

    const enqueueResponse = await page.request.post("/api/matchmaking/enqueue", {
      data: { queueType: "freestyle", battleFormat: "60s" },
    });
    expect(enqueueResponse.ok()).toBeTruthy();

    await ageActiveQueueEntry(user.id, "freestyle", 25_000);

    const statusResponse = await page.request.get("/api/matchmaking/status?queueType=freestyle&battleFormat=60s");
    expect(statusResponse.ok()).toBeTruthy();

    const statusBody = (await statusResponse.json()) as MatchmakingBody;
    expect(statusBody.status).toBe("matched");
    expect(statusBody.matched).toBe(true);
    expect(statusBody.isBotBattle).toBe(true);
    expect(statusBody.fallbackReason).toBe("timed_bot_fallback");
    expect(statusBody.waitTimeMs).toBeGreaterThanOrEqual(20_000);
    expect(statusBody.battleId).toBeTruthy();

    const battleId = statusBody.battleId as string;
    createdBattleIds.add(battleId);

    const battle = await fetchBotBattleMetadata(battleId);
    expect(battle.queue_type).toBe("freestyle");
    expect(battle.battle_type).toBe("casual_bot");
    expect(battle.is_bot_battle).toBe(true);
    expect(battle.mmr_neutral).toBeFalsy();
    expect(battle.fallback_reason).toBe("timed_bot_fallback");
    expect(typeof battle.wait_time_ms).toBe("number");
    expect((battle.wait_time_ms as number) >= 20_000).toBeTruthy();
    expect(battle.bot_personality_id).toBeTruthy();
    expect(battle.bot_difficulty).toBeTruthy();

    await context.close();
  });

  test("ranked queue falls back to an MMR-neutral ranked bot battle", async ({ browser }) => {
    const user = await createVerifiedUser("bot_ranked");
    const context = await browser.newContext();
    const page = await context.newPage();

    await login(page, user);

    const enqueueResponse = await page.request.post("/api/matchmaking/enqueue", {
      data: { queueType: "ranked", battleFormat: "60s" },
    });
    expect(enqueueResponse.ok()).toBeTruthy();

    await ageActiveQueueEntry(user.id, "ranked", 50_000);

    const statusResponse = await page.request.get("/api/matchmaking/status?queueType=ranked&battleFormat=60s");
    expect(statusResponse.ok()).toBeTruthy();

    const statusBody = (await statusResponse.json()) as MatchmakingBody;
    expect(statusBody.status).toBe("matched");
    expect(statusBody.matched).toBe(true);
    expect(statusBody.isBotBattle).toBe(true);
    expect(statusBody.fallbackReason).toBe("timed_bot_fallback");
    expect(statusBody.waitTimeMs).toBeGreaterThanOrEqual(45_000);
    expect(statusBody.battleId).toBeTruthy();

    const battleId = statusBody.battleId as string;
    createdBattleIds.add(battleId);

    const battle = await fetchBotBattleMetadata(battleId);
    expect(battle.queue_type).toBe("ranked");
    expect(battle.battle_type).toBe("ranked_bot");
    expect(battle.is_bot_battle).toBe(true);
    expect(battle.mmr_neutral).toBe(true);
    expect(battle.fallback_reason).toBe("timed_bot_fallback");
    expect(typeof battle.wait_time_ms).toBe("number");
    expect((battle.wait_time_ms as number) >= 45_000).toBeTruthy();
    expect(battle.bot_personality_id).toBeTruthy();
    expect(battle.bot_difficulty).toBeTruthy();

    await context.close();
  });
});
