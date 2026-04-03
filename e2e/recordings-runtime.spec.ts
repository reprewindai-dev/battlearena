import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
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
const hasRecordingsEnv = Boolean(supabaseUrl && serviceRoleKey);

const adminClient = hasRecordingsEnv
  ? createClient(supabaseUrl as string, serviceRoleKey as string)
  : null;

const createdUserIds: string[] = [];
const createdBattleIds: string[] = [];
const createdRecordingIds: string[] = [];

function requireAdminClient() {
  if (!adminClient) {
    throw new Error("recordings_runtime_env_missing");
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

async function setBattleStatus(request: APIRequestContext, battleId: string, status: "live" | "complete") {
  const response = await request.post("/api/battle-session/status", {
    data: { battleId, status },
  });
  if (!response.ok()) {
    throw new Error(`battle_status_${status}_failed:${response.status()}:${await response.text()}`);
  }
}

test.afterAll(async () => {
  if (!adminClient) return;

  if (createdRecordingIds.length > 0) {
    await adminClient.from("battle_recordings").delete().in("id", createdRecordingIds);
  }

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

test("participant can upload finalize list and download recordings after battle completion", async ({ browser }) => {
  test.setTimeout(180_000);
  test.skip(!hasRecordingsEnv, "Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

  const user = await createVerifiedUser("recordings_user");
  const context = await browser.newContext();
  const page = await context.newPage();

  await login(page, user);

  const createResponse = await page.request.post("/api/battle-session");
  if (!createResponse.ok()) {
    throw new Error(`battle_create_failed:${createResponse.status()}:${await createResponse.text()}`);
  }
  const createBody = (await createResponse.json()) as { battleId?: string };
  const battleId = createBody.battleId;
  if (!battleId) throw new Error("battle_create_missing_id");
  createdBattleIds.push(battleId);

  await setBattleStatus(page.request, battleId, "live");
  await setBattleStatus(page.request, battleId, "complete");

  const mimeType = "audio/webm";
  const audioBytes = Buffer.from(`spitzone-recording-${randomSuffix()}`, "utf8");

  const uploadInitResponse = await page.request.post("/api/battle-session/recordings/upload", {
    data: {
      battleId,
      mimeType,
      durationSeconds: 12,
      bytes: audioBytes.byteLength,
    },
  });

  if (!uploadInitResponse.ok()) {
    throw new Error(
      `recording_upload_init_failed:${uploadInitResponse.status()}:${await uploadInitResponse.text()}`,
    );
  }

  const uploadInitBody = (await uploadInitResponse.json()) as {
    ok: true;
    recordingId: string;
    bucket: string;
    path: string;
    token: string;
  };
  createdRecordingIds.push(uploadInitBody.recordingId);

  const { error: uploadError } = await requireAdminClient()
    .storage
    .from(uploadInitBody.bucket)
    .uploadToSignedUrl(uploadInitBody.path, uploadInitBody.token, audioBytes, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`recording_signed_upload_failed:${uploadError.message}`);
  }

  const finalizeResponse = await page.request.post("/api/battle-session/recordings/finalize", {
    data: { recordingId: uploadInitBody.recordingId },
  });
  if (!finalizeResponse.ok()) {
    throw new Error(`recording_finalize_failed:${finalizeResponse.status()}:${await finalizeResponse.text()}`);
  }

  const recordingsResponse = await page.request.get(
    `/api/battle-session/recordings?battleId=${encodeURIComponent(battleId)}`,
  );
  if (!recordingsResponse.ok()) {
    throw new Error(`recordings_list_failed:${recordingsResponse.status()}:${await recordingsResponse.text()}`);
  }

  const recordingsBody = (await recordingsResponse.json()) as {
    ok: true;
    recordings: Array<{
      id: string;
      uploaded_at: string | null;
      storage_bucket: string | null;
      storage_path: string | null;
      bytes: number | null;
      duration_seconds: number | null;
    }>;
  };

  const uploaded = recordingsBody.recordings.find((recording) => recording.id === uploadInitBody.recordingId);
  expect(uploaded).toBeTruthy();
  expect(uploaded?.uploaded_at).toBeTruthy();
  expect(uploaded?.storage_bucket).toBe(uploadInitBody.bucket);
  expect(uploaded?.storage_path).toBe(uploadInitBody.path);
  expect(uploaded?.bytes).toBe(audioBytes.byteLength);
  expect(uploaded?.duration_seconds).toBe(12);

  const downloadResponse = await page.request.get(
    `/api/battle-session/recordings/download?recordingId=${encodeURIComponent(uploadInitBody.recordingId)}`,
  );
  if (!downloadResponse.ok()) {
    throw new Error(`recording_download_failed:${downloadResponse.status()}:${await downloadResponse.text()}`);
  }

  const downloadBody = (await downloadResponse.json()) as { ok: true; url: string };
  expect(downloadBody.url).toContain("http");

  const signedAssetResponse = await page.request.get(downloadBody.url);
  expect(signedAssetResponse.ok()).toBeTruthy();

  await context.close();
});
