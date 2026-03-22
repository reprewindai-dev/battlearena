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

type BattleRow = {
  id: string;
  created_by: string | null;
  status: string;
  queue_type: string | null;
  battle_format: string | null;
  is_bot_battle: boolean | null;
  result: unknown | null;
  voting_closes_at: string | null;
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
    throw new Error("matchmaking_human_env_missing");
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
    throw new Error(`failed_to_create_human_match_user:${error?.message ?? "unknown"}`);
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

async function getBattleRow(battleId: string) {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("battles")
    .select("id,created_by,status,queue_type,battle_format,is_bot_battle,result,voting_closes_at")
    .eq("id", battleId)
    .single();

  if (error || !data) {
    throw new Error(`battle_lookup_failed:${error?.message ?? "unknown"}`);
  }

  return data as BattleRow;
}

async function getBattleParticipants(battleId: string) {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("battle_participants")
    .select("user_id,slot")
    .eq("battle_id", battleId)
    .order("slot", { ascending: true });

  if (error) {
    throw new Error(`battle_participants_lookup_failed:${error.message}`);
  }

  return data ?? [];
}

test.afterAll(async () => {
  if (!adminClient) return;

  if (createdBattleIds.size > 0) {
    const battleIds = Array.from(createdBattleIds);
    await adminClient.from("battle_votes").delete().in("battle_id", battleIds);
    await adminClient.from("battle_messages").delete().in("battle_id", battleIds);
    await adminClient.from("battle_recordings").delete().in("battle_id", battleIds);
    await adminClient.from("battle_participants").delete().in("battle_id", battleIds);
    await adminClient.from("battles").delete().in("id", battleIds);
  }

  if (createdUserIds.length > 0) {
    await adminClient.from("matchmaking_queue").delete().in("user_id", createdUserIds);
    await adminClient.from("users").delete().in("id", createdUserIds);
    await adminClient.from("user_profiles").delete().in("id", createdUserIds);
    await adminClient.from("user_ratings").delete().in("user_id", createdUserIds);
    await adminClient.from("wallets").delete().in("user_id", createdUserIds);

    for (const userId of createdUserIds) {
      await adminClient.auth.admin.deleteUser(userId);
    }
  }
});

test.describe("human matchmaking runtime verification", () => {
  test.skip(!hasAdminEnv, "Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

  test("two users queue, match, join the same live room, finalize, and can requeue", async ({ browser }) => {
    test.setTimeout(180_000);

    const userA = await createVerifiedUser("human_match_a");
    const userB = await createVerifiedUser("human_match_b");

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await login(pageA, userA);
    await login(pageB, userB);

    const enqueueA = await pageA.request.post("/api/matchmaking/enqueue", {
      data: { queueType: "freestyle", battleFormat: "60s" },
    });
    expect(enqueueA.ok()).toBeTruthy();
    const enqueueABody = (await enqueueA.json()) as MatchmakingBody;
    expect(enqueueABody.status).toBe("queued");
    expect(enqueueABody.matched).toBe(false);
    expect(enqueueABody.battleId).toBeNull();

    const enqueueB = await pageB.request.post("/api/matchmaking/enqueue", {
      data: { queueType: "freestyle", battleFormat: "60s" },
    });
    expect(enqueueB.ok()).toBeTruthy();
    const enqueueBBody = (await enqueueB.json()) as MatchmakingBody;
    expect(enqueueBBody.status).toBe("matched");
    expect(enqueueBBody.matched).toBe(true);
    expect(enqueueBBody.isBotBattle).toBe(false);
    expect(enqueueBBody.fallbackReason).toBe("none");
    expect(enqueueBBody.battleId).toBeTruthy();

    const battleId = enqueueBBody.battleId as string;
    createdBattleIds.add(battleId);

    await expect
      .poll(async () => {
        const response = await pageA.request.get("/api/matchmaking/status?queueType=freestyle&battleFormat=60s");
        if (!response.ok()) {
          return null;
        }
        return (await response.json()) as MatchmakingBody;
      }, { timeout: 30_000, intervals: [1000, 2000, 5000] })
      .toMatchObject({
        status: "matched",
        matched: true,
        battleId,
        isBotBattle: false,
        fallbackReason: "none",
      });

    const battleBeforeJoin = await getBattleRow(battleId);
    expect(battleBeforeJoin.status).toBe("matched");
    expect(battleBeforeJoin.queue_type).toBe("freestyle");
    expect(battleBeforeJoin.battle_format).toBe("60s");
    expect(battleBeforeJoin.is_bot_battle).toBeFalsy();

    const participantsBeforeJoin = await getBattleParticipants(battleId);
    expect(participantsBeforeJoin).toHaveLength(2);
    expect(participantsBeforeJoin.map((participant) => participant.user_id).sort()).toEqual([userA.id, userB.id].sort());

    const joinA = await pageA.request.post("/api/battle-session/join", { data: { battleId } });
    const joinB = await pageB.request.post("/api/battle-session/join", { data: { battleId } });
    expect(joinA.ok()).toBeTruthy();
    expect(joinB.ok()).toBeTruthy();

    await expect
      .poll(async () => {
        const battle = await getBattleRow(battleId);
        return battle.status;
      }, { timeout: 20_000, intervals: [1000, 2000, 5000] })
      .toBe("live");

    const tokenProbeA = await pageA.request.get(`/api/livekit/token?room=${encodeURIComponent(battleId)}`);
    const tokenProbeB = await pageB.request.get(`/api/livekit/token?room=${encodeURIComponent(battleId)}`);
    expect(tokenProbeA.ok()).toBeTruthy();
    expect(tokenProbeB.ok()).toBeTruthy();

    const battleUrl = `/app/battles/room?battleId=${encodeURIComponent(battleId)}`;
    await pageA.goto(battleUrl);
    await pageB.goto(battleUrl);

    await expect(pageA.getByTestId("battle-video-production")).toBeVisible();
    await expect(pageB.getByTestId("battle-video-production")).toBeVisible();

    await pageA.getByTestId("join-room").click();
    await pageB.getByTestId("join-room").click();

    await expect(pageA.getByText("connected", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(pageB.getByText("connected", { exact: true })).toBeVisible({ timeout: 20_000 });

    await pageA.getByTestId("enable-camera").click();
    await pageA.getByTestId("enable-mic").click();
    await pageB.getByTestId("enable-camera").click();
    await pageB.getByTestId("enable-mic").click();

    await expect
      .poll(async () => pageA.getByText(/participants:\s*2/i).count())
      .toBeGreaterThan(0);
    await expect
      .poll(async () => pageB.getByText(/participants:\s*2/i).count())
      .toBeGreaterThan(0);

    await pageB.getByRole("button", { name: "Leave Room" }).click();
    await expect
      .poll(async () => pageA.getByText(/participants:\s*1/i).count())
      .toBeGreaterThan(0);

    await pageB.getByTestId("join-room").click();
    await expect
      .poll(async () => pageA.getByText(/participants:\s*2/i).count())
      .toBeGreaterThan(0);

    const client = requireAdminClient();
    await client
      .from("battles")
      .update({
        voting_closes_at: new Date(Date.now() - 1_000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", battleId);

    const finalizeOwner = battleBeforeJoin.created_by === userA.id ? pageA : pageB;
    const finalizeResponse = await finalizeOwner.request.post("/api/battle-session/finalize", {
      data: { battleId },
    });
    expect(finalizeResponse.ok()).toBeTruthy();

    await expect
      .poll(async () => {
        const battle = await getBattleRow(battleId);
        return battle.result ? "saved" : null;
      }, { timeout: 20_000, intervals: [1000, 2000, 5000] })
      .toBe("saved");

    const requeue = await pageA.request.post("/api/matchmaking/enqueue", {
      data: { queueType: "freestyle", battleFormat: "60s", action: "leave" },
    });
    expect(requeue.ok()).toBeTruthy();

    const requeueAgain = await pageA.request.post("/api/matchmaking/enqueue", {
      data: { queueType: "freestyle", battleFormat: "60s" },
    });
    expect(requeueAgain.ok()).toBeTruthy();
    const requeueBody = (await requeueAgain.json()) as MatchmakingBody;
    expect(requeueBody.status).toBe("queued");
    expect(requeueBody.matched).toBe(false);

    await contextA.close();
    await contextB.close();
  });
});
