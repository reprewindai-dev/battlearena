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

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;
const TEST_EMAIL_B = process.env.E2E_TEST_EMAIL_B;
const TEST_PASSWORD_B = process.env.E2E_TEST_PASSWORD_B;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasAdminEnv = Boolean(supabaseUrl && serviceRoleKey);
const hasExplicitTestCredentials = Boolean(TEST_EMAIL && TEST_PASSWORD);
const hasExplicitMatchmakingCredentials = Boolean(TEST_EMAIL && TEST_PASSWORD && TEST_EMAIL_B && TEST_PASSWORD_B);

const adminClient = hasAdminEnv
  ? createClient(supabaseUrl as string, serviceRoleKey as string)
  : null;

const createdUserIds: string[] = [];

function requireAdminClient() {
  if (!adminClient) {
    throw new Error("smoke_test_admin_env_missing");
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
    throw new Error(`failed_to_create_smoke_user:${error?.message ?? "unknown"}`);
  }

  createdUserIds.push(data.user.id);
  return { id: data.user.id, email, password };
}

const provisionedCredentialsPromise: Promise<{ userA: Credentials; userB: Credentials } | null> =
  hasAdminEnv && !hasExplicitMatchmakingCredentials
    ? Promise.all([
        createVerifiedUser("smoke_a"),
        createVerifiedUser("smoke_b"),
      ]).then(([userA, userB]) => ({ userA, userB }))
    : Promise.resolve(null);

async function getAuthenticatedUsers() {
  if (hasExplicitMatchmakingCredentials) {
    return {
      userA: { id: "explicit-a", email: TEST_EMAIL!, password: TEST_PASSWORD! },
      userB: { id: "explicit-b", email: TEST_EMAIL_B!, password: TEST_PASSWORD_B! },
    } satisfies { userA: Credentials; userB: Credentials };
  }

  const provisioned = await provisionedCredentialsPromise;
  if (!provisioned) {
    throw new Error("smoke_test_credentials_missing");
  }

  return provisioned;
}

async function login(page: Page, credentials: Credentials) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 10000 });
}

test.afterAll(async () => {
  if (!adminClient || createdUserIds.length === 0) return;

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
  await expect(page.getByRole("heading", { name: /Walk back into the room/i })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
});

test("signup page renders", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: /Claim your identity before the crowd gets here/i })).toBeVisible();
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
  await expect(page.getByRole("heading").first()).toBeVisible();
});

test.describe("authenticated tests", () => {
  test.skip(!hasExplicitTestCredentials && !hasAdminEnv, "Skipping: real auth credentials or Supabase admin env not set");

  test.beforeEach(async ({ page }) => {
    const { userA } = await getAuthenticatedUsers();
    await login(page, userA);
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
  test.skip(!hasExplicitMatchmakingCredentials && !hasAdminEnv, "Skipping: matchmaking credentials or Supabase admin env not set");

  test("ranked queue matches two users into the same battle", async ({ browser }) => {
    const { userA, userB } = await getAuthenticatedUsers();

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await login(pageA, userA);
    await login(pageB, userB);

    await pageA.goto("/app/battles");
    await pageB.goto("/app/battles");

    await expect(pageA.getByTestId("ranked-queue-card")).toBeVisible();
    await expect(pageB.getByTestId("ranked-queue-card")).toBeVisible();

    await pageA.getByTestId("ranked-queue-join").click();
    await pageA.waitForTimeout(500);
    await pageB.getByTestId("ranked-queue-join").click();

    await expect(pageA).toHaveURL(/\/app\/battles\/room\?battleId=/, { timeout: 30000 });
    await expect(pageB).toHaveURL(/\/app\/battles\/room\?battleId=/, { timeout: 30000 });

    const battleIdA = new URL(pageA.url()).searchParams.get("battleId");
    const battleIdB = new URL(pageB.url()).searchParams.get("battleId");

    expect(battleIdA).toBeTruthy();
    expect(battleIdB).toBeTruthy();
    expect(battleIdA).toBe(battleIdB);

    await contextA.close();
    await contextB.close();
  });
});
