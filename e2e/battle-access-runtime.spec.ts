import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

type Credentials = {
  id: string;
  email: string;
  password: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasAdminEnv = Boolean(supabaseUrl && serviceRoleKey);

const adminClient = hasAdminEnv
  ? createClient(supabaseUrl as string, serviceRoleKey as string)
  : null;

const createdUserIds: string[] = [];
const createdBattleIds: string[] = [];

function requireAdminClient() {
  if (!adminClient) {
    throw new Error("battle_access_runtime_env_missing");
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
    app_metadata: { role: "user" },
    user_metadata: { role: "user" },
  });

  if (error || !data.user) {
    throw new Error(`failed_to_create_access_user:${error?.message ?? "unknown"}`);
  }

  createdUserIds.push(data.user.id);
  return { id: data.user.id, email, password };
}

async function login(page: Page, credentials: Credentials) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 10_000 });
}

test.afterAll(async () => {
  if (!adminClient) return;

  if (createdBattleIds.length > 0) {
    await adminClient.from("battle_votes").delete().in("battle_id", createdBattleIds);
    await adminClient.from("battle_messages").delete().in("battle_id", createdBattleIds);
    await adminClient.from("battle_participants").delete().in("battle_id", createdBattleIds);
    await adminClient.from("battles").delete().in("id", createdBattleIds);
  }

  if (createdUserIds.length > 0) {
    await adminClient.from("matchmaking_queue").delete().in("user_id", createdUserIds);
    await adminClient.from("users").delete().in("id", createdUserIds);
    await adminClient.from("user_profiles").delete().in("user_id", createdUserIds);
    for (const userId of createdUserIds) {
      await adminClient.auth.admin.deleteUser(userId);
    }
  }
});

test("battle chat and vote endpoints reject private battle outsiders but allow spectatable viewers", async ({ browser }) => {
  test.setTimeout(180_000);
  test.skip(!hasAdminEnv, "Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

  const owner = await createVerifiedUser("battle_access_owner");
  const outsider = await createVerifiedUser("battle_access_outsider");
  const spectator = await createVerifiedUser("battle_access_spectator");

  const client = requireAdminClient();
  const now = new Date();
  const future = new Date(now.getTime() + 5 * 60_000).toISOString();

  const { data: battleRows, error: battleError } = await client
    .from("battles")
    .insert({
      created_by: owner.id,
      status: "queued",
      mode: "freestyle",
      queue_type: "freestyle",
      battle_type: "casual",
      format: "60s",
      battle_format: "60s",
      room_code: `Q${Date.now().toString().slice(-9)}`,
      voting_opened_at: now.toISOString(),
      voting_closes_at: future,
    })
    .select("id")
    .limit(1);

  if (battleError || !battleRows?.[0]) {
    throw new Error(`battle_seed_failed:${battleError?.message ?? "unknown"}`);
  }

  const battleId = battleRows[0].id as string;
  createdBattleIds.push(battleId);

  const { error: participantError } = await client
    .from("battle_participants")
    .insert({ battle_id: battleId, user_id: owner.id, slot: 1 });

  if (participantError) {
    throw new Error(`participant_seed_failed:${participantError.message}`);
  }

  const { error: seededMessageError } = await client.from("battle_messages").insert({
    battle_id: battleId,
    created_by: owner.id,
    body: "Seed message",
  });

  if (seededMessageError) {
    throw new Error(`seed_message_failed:${seededMessageError.message}`);
  }

  const outsiderContext = await browser.newContext();
  const spectatorContext = await browser.newContext();
  const outsiderPage = await outsiderContext.newPage();
  const spectatorPage = await spectatorContext.newPage();

  await login(outsiderPage, outsider);
  await login(spectatorPage, spectator);

  const outsiderMessagesGet = await outsiderPage.request.get(
    `/api/battle-session/messages?battleId=${encodeURIComponent(battleId)}`,
  );
  expect(outsiderMessagesGet.status()).toBe(403);

  const outsiderMessagesPost = await outsiderPage.request.post("/api/battle-session/messages", {
    data: { battleId, body: "should fail" },
  });
  expect(outsiderMessagesPost.status()).toBe(403);

  const outsiderVotesGet = await outsiderPage.request.get(
    `/api/battle-session/votes?battleId=${encodeURIComponent(battleId)}`,
  );
  expect(outsiderVotesGet.status()).toBe(403);

  const outsiderVotesPost = await outsiderPage.request.post("/api/battle-session/votes", {
    data: { battleId, slot: 1 },
  });
  expect(outsiderVotesPost.status()).toBe(403);

  const { error: battleLiveError } = await client
    .from("battles")
    .update({
      status: "live",
      voting_opened_at: new Date().toISOString(),
      voting_closes_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", battleId);

  if (battleLiveError) {
    throw new Error(`battle_promote_failed:${battleLiveError.message}`);
  }

  const spectatorMessagesGet = await spectatorPage.request.get(
    `/api/battle-session/messages?battleId=${encodeURIComponent(battleId)}`,
  );
  expect(spectatorMessagesGet.ok()).toBeTruthy();

  const spectatorMessagesPost = await spectatorPage.request.post("/api/battle-session/messages", {
    data: { battleId, body: "spectator allowed" },
  });
  expect(spectatorMessagesPost.ok()).toBeTruthy();

  const spectatorVotesGet = await spectatorPage.request.get(
    `/api/battle-session/votes?battleId=${encodeURIComponent(battleId)}`,
  );
  expect(spectatorVotesGet.ok()).toBeTruthy();

  const spectatorVotesPost = await spectatorPage.request.post("/api/battle-session/votes", {
    data: { battleId, slot: 1 },
  });
  expect(spectatorVotesPost.ok()).toBeTruthy();

  await outsiderContext.close();
  await spectatorContext.close();
});
