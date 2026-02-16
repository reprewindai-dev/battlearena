import { test, expect, type BrowserContext } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:3000";

async function setMockAuth(
  context: BrowserContext,
  role: "user" | "admin",
) {
  await context.addCookies([
    {
      name: "arena_mock_session",
      value: "1",
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "arena_role",
      value: role,
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

test("auth flow renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
});

test("protected routes redirect when logged out", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});

test("RBAC: admin route blocked for non-admin", async ({ context, page }) => {
  await setMockAuth(context, "user");

  await page.goto("/app/admin");
  await expect(page).toHaveURL(/\/app$/);
});

test("battle room loads in skeleton state", async ({ context, page }) => {
  await setMockAuth(context, "admin");

  await page.goto("/app/battles/room");
  await expect(page.getByRole("heading", { name: "Battle Room" })).toBeVisible();
  await expect(page.getByTestId("battle-room")).toBeVisible();
  await expect(page.getByTestId("beat-slot")).toBeVisible();
  await expect(page.getByTestId("recording-slot")).toBeVisible();
  await expect(page.getByTestId("chat-slot")).toBeVisible();
  await expect(page.getByTestId("vote-slot")).toBeVisible();
});

test("ranked queue joins and redirects to battle room", async ({ context, page }) => {
  await setMockAuth(context, "admin");

  await page.goto("/app/battles");
  await expect(page.getByRole("heading", { name: "Battle Lobby" })).toBeVisible();

  await expect(page.getByTestId("ranked-queue-card")).toBeVisible();
  await page.getByTestId("ranked-queue-join").click();

  await expect(page).toHaveURL(/\/app\/battles\/room\?battleId=/);
  await expect(page.getByRole("heading", { name: "Battle Room" })).toBeVisible();
});
