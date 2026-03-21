import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/env";

type AdminUserRecord = {
  id: string;
  app_metadata?: { role?: unknown } | null;
  user_metadata?: { role?: unknown } | null;
};

type OpsAlertSeverity = "info" | "warning" | "critical";

type SystemNotificationInput = {
  userId: string;
  title: string;
  body?: string | null;
  link?: string | null;
  actorId?: string | null;
  type?: "system" | "moderation";
};

type OpsAlertInput = {
  code: string;
  title: string;
  body: string;
  severity: OpsAlertSeverity;
  link?: string | null;
  payload?: Record<string, unknown>;
  throttleMs?: number;
};

const alertThrottle = new Map<string, number>();

function getRole(user: AdminUserRecord) {
  const claim = user.app_metadata?.role ?? user.user_metadata?.role;
  return claim === "admin" || claim === "mod" ? claim : null;
}

export async function sendSystemNotification(
  adminClient: SupabaseClient,
  input: SystemNotificationInput,
) {
  const { error } = await adminClient.from("notifications").insert({
    user_id: input.userId,
    type: input.type ?? "system",
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    actor_id: input.actorId ?? null,
  });

  if (error) {
    throw new Error(`notification_insert_failed:${error.message}`);
  }
}

export async function listPrivilegedUserIds(adminClient: SupabaseClient) {
  const ids = new Set<string>();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`privileged_users_fetch_failed:${error.message}`);
    }

    const users = (data?.users ?? []) as AdminUserRecord[];
    for (const user of users) {
      if (getRole(user)) {
        ids.add(user.id);
      }
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  return Array.from(ids);
}

export async function notifyPrivilegedUsers(
  adminClient: SupabaseClient,
  input: Omit<SystemNotificationInput, "userId" | "type"> & { title: string },
) {
  const userIds = await listPrivilegedUserIds(adminClient);
  if (userIds.length === 0) {
    return { recipients: 0 };
  }

  const rows = userIds.map((userId) => ({
    user_id: userId,
    type: "system",
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    actor_id: input.actorId ?? null,
  }));

  const { error } = await adminClient.from("notifications").insert(rows);
  if (error) {
    throw new Error(`privileged_notifications_failed:${error.message}`);
  }

  return { recipients: userIds.length };
}

async function sendOpsWebhook(input: OpsAlertInput) {
  if (!env.OPS_ALERT_WEBHOOK_URL) {
    return;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (env.OPS_ALERT_WEBHOOK_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${env.OPS_ALERT_WEBHOOK_BEARER_TOKEN}`;
  }

  const response = await fetch(env.OPS_ALERT_WEBHOOK_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      source: "battle-arena",
      severity: input.severity,
      code: input.code,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      payload: input.payload ?? {},
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`ops_webhook_failed:${response.status}`);
  }
}

export async function deliverOpsAlert(adminClient: SupabaseClient, input: OpsAlertInput) {
  const throttleMs = input.throttleMs ?? 10 * 60 * 1000;
  const lastSentAt = alertThrottle.get(input.code) ?? 0;
  if (Date.now() - lastSentAt < throttleMs) {
    return { throttled: true, recipients: 0 };
  }

  const title = `[${input.severity.toUpperCase()}] ${input.title}`;
  const body = input.body;

  const notificationResult = await notifyPrivilegedUsers(adminClient, {
    title,
    body,
    link: input.link ?? "/app/admin/governance",
  });

  await sendOpsWebhook(input).catch((error) => {
    console.error("ops_webhook_delivery_failed", error);
  });

  alertThrottle.set(input.code, Date.now());

  return {
    throttled: false,
    recipients: notificationResult.recipients,
  };
}
