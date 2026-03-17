import { test, expect } from "@playwright/test";

/**
 * Production E2E Tests
 * 
 * These tests verify the application works in production mode with real Supabase auth.
 * Tests that require authentication are skipped if test credentials are not configured.
 * 
 * To run authenticated tests, set these environment variables:
 * - E2E_TEST_EMAIL: Test user email
 * - E2E_TEST_PASSWORD: Test user password
 * - E2E_TEST_EMAIL_B: Second test user email (for matchmaking tests)
 * - E2E_TEST_PASSWORD_B: Second test user password
 */

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;
const TEST_EMAIL_B = process.env.E2E_TEST_EMAIL_B;
const TEST_PASSWORD_B = process.env.E2E_TEST_PASSWORD_B;

const hasTestCredentials = Boolean(TEST_EMAIL && TEST_PASSWORD);
const hasMatchmakingCredentials = Boolean(TEST_EMAIL && TEST_PASSWORD && TEST_EMAIL_B && TEST_PASSWORD_B);

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
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
});

test("signup page renders", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Sign up" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});

test("protected routes redirect when logged out", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toBeVisible();
});

test.describe("authenticated tests", () => {
  test.skip(!hasTestCredentials, "Skipping: E2E_TEST_EMAIL and E2E_TEST_PASSWORD not set");

  test.beforeEach(async ({ page }) => {
    if (!hasTestCredentials) return;
    
    // Login before each test
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_EMAIL!);
    await page.getByLabel("Password").fill(TEST_PASSWORD!);
    await page.getByRole("button", { name: "Login" }).click();
    
    // Wait for redirect to app
    await expect(page).toHaveURL(/\/app/, { timeout: 10000 });
  });

  test("battle room loads", async ({ page }) => {
    await page.goto("/app/battles/room");
    await expect(page.getByRole("heading", { name: "Battle Room" })).toBeVisible();
    await expect(page.getByTestId("battle-room")).toBeVisible();
    await expect(page.getByTestId("beat-slot")).toBeVisible();
    await expect(page.getByTestId("recording-slot")).toBeVisible();
    await expect(page.getByTestId("chat-slot")).toBeVisible();
    await expect(page.getByTestId("vote-slot")).toBeVisible();
  });

  test("battle lobby loads", async ({ page }) => {
    await page.goto("/app/battles");
    await expect(page.getByRole("heading", { name: "Battle Lobby" })).toBeVisible();
    await expect(page.getByTestId("ranked-queue-card")).toBeVisible();
  });

  test("profile page loads", async ({ page }) => {
    await page.goto("/app/profile");
    await expect(page.getByRole("heading", { name: /profile/i })).toBeVisible();
  });
});

test.describe("matchmaking tests", () => {
  test.skip(!hasMatchmakingCredentials, "Skipping: Matchmaking test credentials not set");

  test("ranked queue matches two users into the same battle", async ({ browser }) => {
    if (!hasMatchmakingCredentials) return;

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Login user A
    await pageA.goto("/login");
    await pageA.getByLabel("Email").fill(TEST_EMAIL!);
    await pageA.getByLabel("Password").fill(TEST_PASSWORD!);
    await pageA.getByRole("button", { name: "Login" }).click();
    await expect(pageA).toHaveURL(/\/app/, { timeout: 10000 });

    // Login user B
    await pageB.goto("/login");
    await pageB.getByLabel("Email").fill(TEST_EMAIL_B!);
    await pageB.getByLabel("Password").fill(TEST_PASSWORD_B!);
    await pageB.getByRole("button", { name: "Login" }).click();
    await expect(pageB).toHaveURL(/\/app/, { timeout: 10000 });

    // Navigate to battles
    await pageA.goto("/app/battles");
    await pageB.goto("/app/battles");

    await expect(pageA.getByTestId("ranked-queue-card")).toBeVisible();
    await expect(pageB.getByTestId("ranked-queue-card")).toBeVisible();

    // Join ranked queue
    await pageA.getByTestId("ranked-queue-join").click();
    await pageA.waitForTimeout(500);
    await pageB.getByTestId("ranked-queue-join").click();

    // Wait for match
    await expect(pageA).toHaveURL(/\/app\/battles\/room\?battleId=/, { timeout: 30000 });
    await expect(pageB).toHaveURL(/\/app\/battles\/room\?battleId=/);

    const battleIdA = new URL(pageA.url()).searchParams.get("battleId");
    const battleIdB = new URL(pageB.url()).searchParams.get("battleId");

    expect(battleIdA).toBeTruthy();
    expect(battleIdB).toBeTruthy();
    expect(battleIdA).toBe(battleIdB);

    await contextA.close();
    await contextB.close();
  });
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
