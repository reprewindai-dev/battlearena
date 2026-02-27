#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function envOrThrow(key) {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env ${key}`);
  return val;
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@arena.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin#12345!";
const USER_EMAIL = process.env.SEED_USER_EMAIL || "user@arena.local";
const USER_PASSWORD = process.env.SEED_USER_PASSWORD || "User#12345!";

async function ensureUser(email, password, role = "user") {
  const username = email.split("@")[0];
  const display_name = username.replace(/[^a-zA-Z0-9]/g, " ").trim() || username;
  async function findUserByEmail(target) {
    let page = 1;
    const perPage = 200;
    while (true) {
      const res = await supabase.auth.admin.listUsers({ page, perPage });
      if (res.error) throw new Error(`listUsers failed: ${res.error.message}`);
      const found = res.data.users.find((u) => (u.email || "").toLowerCase() === target.toLowerCase());
      if (found) return found;
      if (res.data.users.length < perPage) return null;
      page += 1;
    }
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    const user = existing;
    const currentRole = user.app_metadata?.role ?? user.user_metadata?.role;
    if (currentRole !== role || !user.user_metadata?.username) {
      await supabase.auth.admin.updateUserById(user.id, {
        app_metadata: { ...(user.app_metadata || {}), role },
        user_metadata: {
          ...(user.user_metadata || {}),
          role,
          username: user.user_metadata?.username || username,
          display_name: user.user_metadata?.display_name || display_name,
        },
      });
    }
    return user.id;
  }

  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { role, username, display_name },
  });
  if (created.error) {
    console.error(`createUser error for ${email}:`, created.error);
    const users = await supabase.auth.admin.listUsers();
    console.log("Existing users:", users.data.users);
    const user = await findUserByEmail(email);
    if (user) return user.id;
  }
  if (created.error || !created.data.user) {
    throw new Error(`Failed to create user ${email}: ${created.error?.message}`);
  }
  return created.data.user.id;
}

async function pickActiveBeat() {
  const { data, error } = await supabase
    .from("beats")
    .select("id,title,artist")
    .eq("is_active", true)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error(`No active beat found: ${error?.message}`);
  return data;
}

function roomCode() {
  return crypto.randomBytes(4).toString("hex").slice(0, 8).toUpperCase();
}

async function seedBattleData({ adminId, userId, beatId }) {
  // Battles table (legacy lobby view)
  const battleRes = await supabase
    .from("battles")
    .insert({
      battle_type: "ranked",
      mode: "ranked",
      format: "60s",
      status: "waiting",
      room_code: roomCode(),
      beat_id: beatId,
      entry_fee_tokens: 0,
      prize_pool_tokens: 0,
      total_rounds: 2,
      created_by: adminId,
    })
    .select("id")
    .single();
  if (battleRes.error) throw new Error(`Failed to create battle: ${battleRes.error.message}`);
  const battleId = battleRes.data.id;

  const participants = [
    { battle_id: battleId, user_id: adminId, result: null, rounds_completed: 0 },
    { battle_id: battleId, user_id: userId, result: null, rounds_completed: 0 },
  ];
  const partRes = await supabase.from("battle_participants").insert(participants);
  if (partRes.error) throw new Error(`Failed to insert battle participants: ${partRes.error.message}`);

  // Battle sessions (newer flow)
  const sessionRes = await supabase
    .from("battle_sessions")
    .insert({
      creator_id: adminId,
      battle_type: "ranked",
      format: "60s",
      total_rounds: 2,
      status: "queued",
      locked_beat_id: beatId,
    })
    .select("id")
    .single();
  if (sessionRes.error) throw new Error(`Failed to create battle session: ${sessionRes.error.message}`);
  const sessionId = sessionRes.data.id;

  const sessionParticipants = [
    { session_id: sessionId, user_id: adminId, slot: 1, display_name: "Admin" },
    { session_id: sessionId, user_id: userId, slot: 2, display_name: "Challenger" },
  ];
  const spRes = await supabase.from("battle_participants").insert(sessionParticipants);
  if (spRes.error) throw new Error(`Failed to insert session participants: ${spRes.error.message}`);

  return { battleId, sessionId };
}

async function main() {
  console.log("Seeding auth users and battle data...");
  const adminId = await ensureUser(ADMIN_EMAIL, ADMIN_PASSWORD, "admin");
  const userId = await ensureUser(USER_EMAIL, USER_PASSWORD, "user");
  console.log("Users ready", { adminId, userId });

  const beat = await pickActiveBeat();
  console.log("Using beat", beat);

  const ids = await seedBattleData({ adminId, userId, beatId: beat.id });
  console.log("Seed complete", { ...ids, adminEmail: ADMIN_EMAIL, userEmail: USER_EMAIL });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
