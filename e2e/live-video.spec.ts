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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const livekitHealthUrl = process.env.LIVEKIT_HEALTH_URL ?? "http://127.0.0.1:7880/";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("LIVE VIDEO E2E requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);
const createdUserIds: string[] = [];
const createdBattleIds: string[] = [];

function randomSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

async function createVerifiedUser(prefix: string): Promise<Credentials> {
  const email = `${prefix}_${randomSuffix()}@battlearena-e2e.local`;
  const password = `E2E_${randomSuffix()}_Strong!`;

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`failed_to_create_e2e_user:${error?.message ?? "unknown"}`);
  }

  createdUserIds.push(data.user.id);
  return { id: data.user.id, email, password };
}

async function login(page: Page, credentials: Credentials) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/app/);
}

test.afterAll(async () => {
  if (createdBattleIds.length > 0) {
    await adminClient.from("battle_participants").delete().in("battle_id", createdBattleIds);
    await adminClient.from("battles").delete().in("id", createdBattleIds);
  }

  if (createdUserIds.length > 0) {
    await adminClient.from("matchmaking_queue").delete().in("user_id", createdUserIds);
    await adminClient.from("users").delete().in("id", createdUserIds);
    for (const userId of createdUserIds) {
      await adminClient.auth.admin.deleteUser(userId);
    }
  }
});

test("two authenticated users can publish and observe live video state", async ({ browser }) => {
  test.setTimeout(180_000);

  try {
    const health = await fetch(livekitHealthUrl);
    if (!health.ok) {
      throw new Error(`livekit_unhealthy_status:${health.status}`);
    }
  } catch (error) {
    throw new Error(
      `livekit_not_reachable:${livekitHealthUrl}:${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const userA = await createVerifiedUser("video_a");
  const userB = await createVerifiedUser("video_b");

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await login(pageA, userA);
  await login(pageB, userB);

  const createResponse = await pageA.request.post("/api/battle-session");
  if (!createResponse.ok()) {
    throw new Error(`battle_create_failed:${createResponse.status()}:${await createResponse.text()}`);
  }
  const createBody = (await createResponse.json()) as { battleId?: string };
  const battleId = createBody.battleId;
  if (!battleId) throw new Error("battle_create_missing_id");
  createdBattleIds.push(battleId);

  const joinResponse = await pageB.request.post("/api/battle-session/join", {
    data: { battleId },
  });
  if (!joinResponse.ok()) {
    throw new Error(`battle_join_failed:${joinResponse.status()}:${await joinResponse.text()}`);
  }

  const tokenProbeA = await pageA.request.get(
    `/api/livekit/token?room=${encodeURIComponent(battleId)}&participant=${encodeURIComponent(userA.id)}`,
  );
  if (!tokenProbeA.ok()) {
    throw new Error(`token_probe_a_failed:${tokenProbeA.status()}:${await tokenProbeA.text()}`);
  }
  const tokenProbeB = await pageB.request.get(
    `/api/livekit/token?room=${encodeURIComponent(battleId)}&participant=${encodeURIComponent(userB.id)}`,
  );
  if (!tokenProbeB.ok()) {
    throw new Error(`token_probe_b_failed:${tokenProbeB.status()}:${await tokenProbeB.text()}`);
  }

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
    .poll(async () => {
      return pageA.getByText(/participants:\s*2/i).count();
    })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => {
      return pageB.getByText(/participants:\s*2/i).count();
    })
    .toBeGreaterThan(0);

  await pageB.getByRole("button", { name: "Leave Room" }).click();
  await expect
    .poll(async () => {
      return pageA.getByText(/participants:\s*1/i).count();
    })
    .toBeGreaterThan(0);

  await pageB.getByTestId("join-room").click();
  await expect
    .poll(async () => {
      return pageA.getByText(/participants:\s*2/i).count();
    })
    .toBeGreaterThan(0);

  await contextA.close();
  await contextB.close();
});
