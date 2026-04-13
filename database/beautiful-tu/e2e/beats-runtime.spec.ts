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

type UploadedBeat = {
  id: string;
  title: string;
  artist: string;
  tempo: number;
  genre: string;
  preview_url: string;
  file_url: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasAdminEnv = Boolean(supabaseUrl && serviceRoleKey);
const storageBucket = process.env.BEATS_STORAGE_BUCKET ?? "beats";

const adminClient = hasAdminEnv
  ? createClient(supabaseUrl as string, serviceRoleKey as string)
  : null;

const createdUserIds: string[] = [];
const createdBeatIds: string[] = [];
const createdStoragePaths: string[] = [];

function requireAdminClient() {
  if (!adminClient) {
    throw new Error("beats_runtime_env_missing");
  }
  return adminClient;
}

function randomSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

function createWavBuffer(seconds: number) {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const totalSamples = sampleRate * seconds;
  const dataSize = totalSamples * numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < totalSamples; i += 1) {
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 32767 * 0.2);
    buffer.writeInt16LE(sample, 44 + i * 2);
  }

  return buffer;
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
    throw new Error(`failed_to_create_beats_user:${error?.message ?? "unknown"}`);
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

function extractStoragePath(publicUrl: string) {
  const url = new URL(publicUrl);
  const marker = `/storage/v1/object/public/${storageBucket}/`;
  const index = url.pathname.indexOf(marker);
  if (index < 0) return null;
  return url.pathname.slice(index + marker.length);
}

test.afterAll(async () => {
  if (!adminClient) return;

  if (createdBeatIds.length > 0) {
    await adminClient.from("beats").delete().in("id", createdBeatIds);
  }

  if (createdStoragePaths.length > 0) {
    await adminClient.storage.from(storageBucket).remove(createdStoragePaths);
  }

  if (createdUserIds.length > 0) {
    await adminClient.from("users").delete().in("id", createdUserIds);
    for (const userId of createdUserIds) {
      await adminClient.auth.admin.deleteUser(userId);
    }
  }
});

test.describe("beats runtime verification", () => {
  test.skip(!hasAdminEnv, "Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

  test("beat upload is restricted to admin or mod users", async ({ browser }) => {
    const user = await createVerifiedUser("beats_user", "user");
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, user);

    const beatData = {
      title: `Unauthorized Upload ${randomSuffix()}`,
      artist: "Runtime Test",
      tempo: 92,
      genre: "hip-hop",
      key_signature: "Am",
    };

    const response = await page.request.post("/api/beats", {
      multipart: {
        beatData: JSON.stringify(beatData),
        audioFile: {
          name: "unauthorized-full.wav",
          mimeType: "audio/wav",
          buffer: createWavBuffer(2),
        },
        previewFile: {
          name: "unauthorized-preview.wav",
          mimeType: "audio/wav",
          buffer: createWavBuffer(1),
        },
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("forbidden");

    await context.close();
  });

  test("admin beat upload persists to storage and renders in the beat library", async ({ browser }) => {
    const admin = await createVerifiedUser("beats_admin", "admin");
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, admin);

    const title = `Runtime Beat ${randomSuffix()}`;
    const uploadResponse = await page.request.post("/api/beats", {
      multipart: {
        beatData: JSON.stringify({
          title,
          artist: "Battle Arena QA",
          tempo: 96,
          genre: "hip-hop",
          key_signature: "Am",
          duration_seconds: 2,
          license_type: "standard",
        }),
        audioFile: {
          name: "runtime-full.wav",
          mimeType: "audio/wav",
          buffer: createWavBuffer(2),
        },
        previewFile: {
          name: "runtime-preview.wav",
          mimeType: "audio/wav",
          buffer: createWavBuffer(1),
        },
      },
    });

    expect(uploadResponse.status()).toBe(201);
    const uploadBody = (await uploadResponse.json()) as { ok: true; beat: UploadedBeat };
    expect(uploadBody.ok).toBe(true);
    expect(uploadBody.beat.title).toBe(title);
    expect(uploadBody.beat.preview_url).toContain(`/storage/v1/object/public/${storageBucket}/`);
    expect(uploadBody.beat.file_url).toContain(`/storage/v1/object/public/${storageBucket}/`);

    createdBeatIds.push(uploadBody.beat.id);

    const audioPath = extractStoragePath(uploadBody.beat.file_url);
    const previewPath = extractStoragePath(uploadBody.beat.preview_url);
    if (audioPath) createdStoragePaths.push(audioPath);
    if (previewPath) createdStoragePaths.push(previewPath);

    await page.goto("/app/beats");
    await page.getByPlaceholder("Search beats...").fill(title);
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 20000 });

    const beatsResponse = await page.request.get("/api/beats?limit=100&sort_by=created_at&sort_order=desc");
    expect(beatsResponse.ok()).toBeTruthy();
    const beatsBody = (await beatsResponse.json()) as { beats: UploadedBeat[] };
    const uploadedBeat = beatsBody.beats.find((beat) => beat.id === uploadBody.beat.id);
    expect(uploadedBeat).toBeTruthy();
    expect(uploadedBeat?.preview_url).toBe(uploadBody.beat.preview_url);

    const previewFetch = await fetch(uploadBody.beat.preview_url);
    const audioFetch = await fetch(uploadBody.beat.file_url);
    expect(previewFetch.ok).toBe(true);
    expect(audioFetch.ok).toBe(true);

    await context.close();
  });
});
