import { expect, test, type BrowserContext, devices } from "@playwright/test";
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

function requireAdminClient() {
  if (!adminClient) {
    throw new Error("auth_runtime_env_missing");
  }

  return adminClient;
}

function randomSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

async function createVerifiedUser(prefix: string): Promise<Credentials> {
  const client = requireAdminClient();
  const email = `${prefix}_${randomSuffix()}@spitzone-e2e.local`;
  const password = `E2E_${randomSuffix()}_Strong!`;

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`failed_to_create_auth_user:${error?.message ?? "unknown"}`);
  }

  createdUserIds.push(data.user.id);
  return { id: data.user.id, email, password };
}

async function loginAndAssert(context: BrowserContext, credentials: Credentials) {
  const page = await context.newPage();

  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

  return page;
}

async function assertSessionPersistence(page: Awaited<ReturnType<typeof loginAndAssert>>) {
  await page.goto("/app/profile");
  await expect(page).toHaveURL(/\/app\/profile/, { timeout: 10000 });
  await expect(page.getByRole("button", { name: "Edit Profile" })).toBeVisible({ timeout: 10000 });

  await page.reload();
  await expect(page).toHaveURL(/\/app\/profile/, { timeout: 10000 });

  const profileResponse = await page.request.get("/api/profile/me");
  expect(profileResponse.status()).toBe(200);
  const profileBody = await profileResponse.json();
  expect(profileBody?.profile).toBeTruthy();

  await page.goto("/app");
  await expect(page).toHaveURL(/\/app/, { timeout: 10000 });
}

test.afterAll(async () => {
  if (!adminClient || createdUserIds.length === 0) return;

  await adminClient.from("users").delete().in("id", createdUserIds);
  await adminClient.from("user_profiles").delete().in("user_id", createdUserIds);

  for (const userId of createdUserIds) {
    await adminClient.auth.admin.deleteUser(userId);
  }
});

test.describe("auth runtime verification", () => {
  test.skip(!hasAdminEnv, "Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

  test("desktop login persists session after refresh", async ({ browser }) => {
    const user = await createVerifiedUser("auth_desktop");
    const context = await browser.newContext();
    const page = await loginAndAssert(context, user);

    await assertSessionPersistence(page);
    await context.close();
  });

  test("mobile login persists session after refresh", async ({ browser }) => {
    const user = await createVerifiedUser("auth_mobile");
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await loginAndAssert(context, user);

    await assertSessionPersistence(page);
    await context.close();
  });
});
