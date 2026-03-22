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

type AppRole = "user" | "mod" | "admin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasAdminEnv = Boolean(supabaseUrl && serviceRoleKey);

const adminClient = hasAdminEnv
  ? createClient(supabaseUrl as string, serviceRoleKey as string)
  : null;

const createdUserIds: string[] = [];
const createdTournamentIds: string[] = [];

function requireAdminClient() {
  if (!adminClient) {
    throw new Error("tournaments_runtime_env_missing");
  }
  return adminClient;
}

function randomSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

async function createVerifiedUser(prefix: string, role: AppRole): Promise<Credentials> {
  const client = requireAdminClient();
  const email = `${prefix}_${randomSuffix()}@battlearena-e2e.local`;
  const password = `E2E_${randomSuffix()}_Strong!`;

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { role },
  });

  if (error || !data.user) {
    throw new Error(`failed_to_create_tournament_user:${error?.message ?? "unknown"}`);
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

async function getTokenBalance(userId: string) {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("user_profiles")
    .select("token_balance")
    .eq("user_id", userId)
    .single();

  if (error) {
    throw new Error(`token_balance_lookup_failed:${error.message}`);
  }

  return Number(data.token_balance ?? 0);
}

test.afterAll(async () => {
  if (!adminClient) return;

  if (createdTournamentIds.length > 0) {
    await adminClient.from("activity_feed").delete().in("subject_id", createdTournamentIds);
    await adminClient.from("token_transactions").delete().in("reference_id", createdTournamentIds);
    await adminClient.from("tournament_participants").delete().in("tournament_id", createdTournamentIds);
    await adminClient.from("tournaments").delete().in("id", createdTournamentIds);
  }

  if (createdUserIds.length > 0) {
    await adminClient.from("users").delete().in("id", createdUserIds);
    await adminClient.from("user_profiles").delete().in("user_id", createdUserIds);
    for (const userId of createdUserIds) {
      await adminClient.auth.admin.deleteUser(userId);
    }
  }
});

test.describe("tournament runtime verification", () => {
  test.skip(!hasAdminEnv, "Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

  test("registration debits canonical token balance and duplicate registration does not double-charge", async ({ browser }) => {
    const admin = await createVerifiedUser("tournament_admin", "admin");
    const player = await createVerifiedUser("tournament_player", "user");

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, admin);

    const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const registrationEndsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const entryFee = 25;

    const createResponse = await adminPage.request.post("/api/tournaments", {
      data: {
        name: `Runtime Tournament ${randomSuffix()}`,
        description: "Production runtime debit verification",
        format: "single_elimination",
        tournament_type: "open",
        max_participants: 16,
        entry_fee_tokens: entryFee,
        prize_pool_tokens: 100,
        starts_at: startsAt,
        registration_ends_at: registrationEndsAt,
      },
    });

    expect(createResponse.status()).toBe(201);
    const createBody = (await createResponse.json()) as { tournament?: { id?: string } };
    const tournamentId = createBody.tournament?.id;
    expect(tournamentId).toBeTruthy();
    createdTournamentIds.push(tournamentId as string);

    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    await login(playerPage, player);
    const bootstrapResponse = await playerPage.request.get("/api/profile/me");
    expect(bootstrapResponse.status()).toBe(200);

    const client = requireAdminClient();
    const { error: fundError } = await client.rpc("increment_user_token_balance", {
      p_user_id: player.id,
      p_delta: 100,
    });
    if (fundError) {
      throw new Error(`player_funding_failed:${fundError.message}`);
    }

    const balanceBefore = await getTokenBalance(player.id);
    expect(balanceBefore).toBeGreaterThanOrEqual(100);

    const registerResponse = await playerPage.request.post(
      `/api/tournaments/${encodeURIComponent(tournamentId as string)}/register`,
    );
    expect(registerResponse.status()).toBe(201);

    const balanceAfterRegister = await getTokenBalance(player.id);
    expect(balanceAfterRegister).toBe(balanceBefore - entryFee);

    const { data: participant } = await client
      .from("tournament_participants")
      .select("id,status")
      .eq("tournament_id", tournamentId)
      .eq("user_id", player.id)
      .single();
    expect(participant?.id).toBeTruthy();
    expect(participant?.status).toBe("registered");

    const { data: tokenTx } = await client
      .from("token_transactions")
      .select("id,tokens_spent,transaction_type,reference_id")
      .eq("user_id", player.id)
      .eq("reference_id", tournamentId)
      .eq("transaction_type", "tournament_entry_fee")
      .maybeSingle();
    expect(tokenTx?.id).toBeTruthy();
    expect(tokenTx?.tokens_spent).toBe(entryFee);

    const duplicateResponse = await playerPage.request.post(
      `/api/tournaments/${encodeURIComponent(tournamentId as string)}/register`,
    );
    expect(duplicateResponse.status()).toBe(409);

    const balanceAfterDuplicate = await getTokenBalance(player.id);
    expect(balanceAfterDuplicate).toBe(balanceAfterRegister);

    await adminContext.close();
    await playerContext.close();
  });
});
