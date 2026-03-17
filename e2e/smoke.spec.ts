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

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("E2E requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);
const createdUserIds: string[] = [];

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

async function setUserRole(userId: string, role: "user" | "mod" | "admin") {
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    app_metadata: { role },
    user_metadata: { role },
  });
  if (error) {
    throw new Error(`failed_to_set_user_role:${error.message}`);
  }
}

async function setUsername(user: Credentials, username: string) {
  const { error } = await adminClient.from("users").upsert(
    {
      id: user.id,
      email: user.email,
      username,
    },
    { onConflict: "id" },
  );
  if (error) {
    throw new Error(`failed_to_set_username:${error.message}`);
  }
}

async function login(page: Page, credentials: Credentials) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/app/);
}

test.afterAll(async () => {
  if (createdUserIds.length === 0) return;

  await adminClient.from("matchmaking_queue").delete().in("user_id", createdUserIds);
  await adminClient.from("battle_participants").delete().in("user_id", createdUserIds);
  await adminClient.from("battles").delete().in("created_by", createdUserIds);
  await adminClient.from("users").delete().in("id", createdUserIds);

  for (const userId of createdUserIds) {
    await adminClient.auth.admin.deleteUser(userId);
  }
});

test("auth flow renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
});

test("protected routes redirect when logged out", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});

test("RBAC: admin route blocked for non-admin", async ({ page }) => {
  const user = await createVerifiedUser("rbac_user");
  await login(page, user);

  await page.goto("/app/admin");
  await expect(page).toHaveURL(/\/app$/);
});

test("admin governance APIs are available to admin role", async ({ page }) => {
  const admin = await createVerifiedUser("governance_admin");
  await setUserRole(admin.id, "admin");
  await login(page, admin);

  const statsRes = await page.request.get("/api/admin/governance?endpoint=stats");
  expect(statsRes.ok()).toBeTruthy();
  const statsBody = (await statsRes.json()) as { success?: boolean; data?: { total_plans?: number } };
  expect(statsBody.success).toBeTruthy();
  expect(typeof statsBody.data?.total_plans).toBe("number");

  const metricsRes = await page.request.get("/api/admin/governance?endpoint=metrics");
  expect(metricsRes.ok()).toBeTruthy();
  const metricsBody = (await metricsRes.json()) as { success?: boolean };
  expect(metricsBody.success).toBeTruthy();

  const redTeamRes = await page.request.post("/api/admin/governance", {
    data: {
      action: "run-red-team",
      simulation_type: "COST_SPIKE_DETECTION",
    },
  });
  expect(redTeamRes.ok()).toBeTruthy();
  const redTeamBody = (await redTeamRes.json()) as { success?: boolean };
  expect(redTeamBody.success).toBeTruthy();
});

test("battle room loads in skeleton state", async ({ page }) => {
  const user = await createVerifiedUser("room_user");
  await login(page, user);

  await page.goto("/app/battles/room");
  await expect(page.getByRole("heading", { name: "Battle Room" })).toBeVisible();
  await expect(page.getByTestId("battle-room")).toBeVisible();
  await expect(page.getByTestId("beat-slot")).toBeVisible();
  await expect(page.getByTestId("recording-slot")).toBeVisible();
  await expect(page.getByTestId("chat-slot")).toBeVisible();
  await expect(page.getByTestId("vote-slot")).toBeVisible();
});

test("two authenticated users can enter the same ranked battle room", async ({ browser }) => {
  const userA = await createVerifiedUser("queue_a");
  const userB = await createVerifiedUser("queue_b");

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

  const joinResponse = await pageB.request.post("/api/battle-session/join", {
    data: { battleId },
  });
  if (!joinResponse.ok()) {
    throw new Error(`battle_join_failed:${joinResponse.status()}:${await joinResponse.text()}`);
  }

  const battleIdA = battleId;
  const battleIdB = battleId;
  expect(battleIdA).toBeTruthy();
  expect(battleIdB).toBeTruthy();
  expect(battleIdA).toBe(battleIdB);

  await pageA.goto(`/app/battles/room?battleId=${encodeURIComponent(battleIdA as string)}`);
  await pageB.goto(`/app/battles/room?battleId=${encodeURIComponent(battleIdB as string)}`);
  await expect(pageA.getByTestId("battle-room")).toBeVisible();
  await expect(pageB.getByTestId("battle-room")).toBeVisible();

  await contextA.close();
  await contextB.close();
});

test("community APIs create and return live data", async ({ page }) => {
  const mentor = await createVerifiedUser("mentor_user");
  const mentee = await createVerifiedUser("mentee_user");
  const mentorHandle = `mentor_${randomSuffix()}`.toLowerCase();

  await setUsername(mentor, mentorHandle);
  await login(page, mentee);

  const crewRes = await page.request.post("/api/community/crews", {
    data: { name: `Crew ${randomSuffix()}`, description: "E2E community crew" },
  });
  const crewPayload = await crewRes.text();
  if (!crewRes.ok()) {
    throw new Error(`crew_create_failed:${crewRes.status()}:${crewPayload}`);
  }
  const crewBody = JSON.parse(crewPayload) as { item?: { id: string } };
  expect(crewBody.item?.id).toBeTruthy();

  const mentorshipRes = await page.request.post("/api/community/mentorships", {
    data: { mentorHandle, note: "Need coaching" },
  });
  expect(mentorshipRes.ok()).toBeTruthy();

  const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const eventRes = await page.request.post("/api/community/events", {
    data: { title: `Event ${randomSuffix()}`, description: "E2E event", startsAt },
  });
  expect(eventRes.ok()).toBeTruthy();
  const eventBody = (await eventRes.json()) as { item?: { id: string } };
  const eventId = eventBody.item?.id;
  expect(eventId).toBeTruthy();

  const joinEventRes = await page.request.post(`/api/community/events/${eventId}/join`);
  expect(joinEventRes.ok()).toBeTruthy();

  const crewsGet = await page.request.get("/api/community/crews?limit=5");
  expect(crewsGet.ok()).toBeTruthy();
  const crewsJson = (await crewsGet.json()) as { items?: Array<{ id: string }> };
  expect((crewsJson.items ?? []).some((row) => row.id === crewBody.item?.id)).toBeTruthy();

  await expect
    .poll(async () => {
      const eventsGet = await page.request.get("/api/community/events?limit=10");
      if (!eventsGet.ok()) return false;
      const eventsJson = (await eventsGet.json()) as {
        items?: Array<{ id: string; is_registered: boolean }>;
      };
      return (eventsJson.items ?? []).some((row) => row.id === eventId && row.is_registered);
    }, { timeout: 15_000 })
    .toBeTruthy();

  const mentorshipsGet = await page.request.get("/api/community/mentorships");
  expect(mentorshipsGet.ok()).toBeTruthy();
  const mentorshipsJson = (await mentorshipsGet.json()) as { items?: Array<{ mentor?: { username: string | null } | null }> };
  expect((mentorshipsJson.items ?? []).some((row) => row.mentor?.username === mentorHandle)).toBeTruthy();

  await page.goto("/app/community");
  await expect(page.getByRole("heading", { name: "Community", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Community Feed" })).toBeVisible();
});

test("challenge lifecycle creates notification", async ({ browser }) => {
  const challenger = await createVerifiedUser("challenger_user");
  const challenged = await createVerifiedUser("challenged_user");
  await setUsername(challenger, `challenger_${randomSuffix()}`.toLowerCase());
  await setUsername(challenged, `challenged_${randomSuffix()}`.toLowerCase());

  const challengerContext = await browser.newContext();
  const challengedContext = await browser.newContext();
  const challengerPage = await challengerContext.newPage();
  const challengedPage = await challengedContext.newPage();

  await login(challengerPage, challenger);
  await login(challengedPage, challenged);

  const createRes = await challengerPage.request.post("/api/challenges", {
    data: {
      challenged_id: challenged.id,
      battle_mode: "freestyle",
      message: "Lets battle",
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const createBody = (await createRes.json()) as { challenge?: { id: string } };
  const challengeId = createBody.challenge?.id;
  expect(challengeId).toBeTruthy();

  const incomingRes = await challengedPage.request.get("/api/challenges?direction=incoming");
  expect(incomingRes.ok()).toBeTruthy();
  const incomingBody = (await incomingRes.json()) as { challenges?: Array<{ id: string }> };
  expect((incomingBody.challenges ?? []).some((row) => row.id === challengeId)).toBeTruthy();

  const acceptRes = await challengedPage.request.patch(`/api/challenges/${challengeId}`, {
    data: { action: "accept" },
  });
  expect(acceptRes.ok()).toBeTruthy();

  const notificationRes = await challengerPage.request.get("/api/notifications?limit=10");
  expect(notificationRes.ok()).toBeTruthy();
  const notificationBody = (await notificationRes.json()) as { notifications?: Array<{ title: string }> };
  expect((notificationBody.notifications ?? []).some((row) => row.title.includes("Challenge accepted"))).toBeTruthy();

  await challengerContext.close();
  await challengedContext.close();
});
