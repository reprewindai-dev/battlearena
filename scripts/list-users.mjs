#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const page = parseInt(process.env.PAGE || "1", 10);
const perPage = parseInt(process.env.PER_PAGE || "20", 10);

const res = await supabase.auth.admin.listUsers({ page, perPage });
if (res.error) {
  console.error(res.error);
  process.exit(1);
}
console.log(JSON.stringify(res.data.users.map((u) => ({ id: u.id, email: u.email, role: u.app_metadata?.role || u.user_metadata?.role })), null, 2));
