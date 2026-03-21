import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_ANON_KEY: z.string().min(1).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    CRON_CLEANUP_SECRET: z.string().min(16).optional(),
    OPS_ALERTS_SECRET: z.string().min(16).optional(),
    OPS_ALERT_WEBHOOK_URL: z.string().url().optional(),
    OPS_ALERT_WEBHOOK_BEARER_TOKEN: z.string().min(1).optional(),
    GOV_ENABLED: z.enum(["true", "false"]).optional(),
    GOV_TRACE_ONLY: z.enum(["true", "false"]).optional(),
    GOV_ENFORCE_BLOCKS: z.enum(["true", "false"]).optional(),
    BEATS_STORAGE_BUCKET: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: z.string().min(1).optional(),
  },
  runtimeEnv: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_CLEANUP_SECRET: process.env.CRON_CLEANUP_SECRET,
    OPS_ALERTS_SECRET: process.env.OPS_ALERTS_SECRET,
    OPS_ALERT_WEBHOOK_URL: process.env.OPS_ALERT_WEBHOOK_URL,
    OPS_ALERT_WEBHOOK_BEARER_TOKEN: process.env.OPS_ALERT_WEBHOOK_BEARER_TOKEN,
    GOV_ENABLED: process.env.GOV_ENABLED,
    GOV_TRACE_ONLY: process.env.GOV_TRACE_ONLY,
    GOV_ENFORCE_BLOCKS: process.env.GOV_ENFORCE_BLOCKS,
    BEATS_STORAGE_BUCKET: process.env.BEATS_STORAGE_BUCKET,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  },
  emptyStringAsUndefined: true,
});
