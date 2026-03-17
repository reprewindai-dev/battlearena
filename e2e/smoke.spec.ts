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
  await expect(page.getByRole("heading").first()).toBeVisible();
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
