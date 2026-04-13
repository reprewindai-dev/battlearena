# Battle Arena — Buyer Transfer Guide

## Files Included

1. **battlearena/battle-arena-migration-dump.sql** — Complete database schema (tables, types, functions, RLS policies)
2. **battle-arena-full-data.sql** — All data from your current project (107 users, 78 beats, etc.)
3. **.env.local** — Your current environment configuration (for reference only)

## Step 1: Create New Supabase Project

✅ **Already Done** — You've created the "spitzone" project in studiogradekits@gmail.com's org

- Project URL: https://wnehpqxrniobrccrvclj.supabase.co
- Status: Healthy
- Ready for schema import

If you need to create a different project, follow these steps:
1. Login to https://supabase.com/dashboard
2. Click "New Project"
3. **Important:** Create in your own organization (NOT reprewindai-dev's org)
4. Project name: `battle-arena-prod` (or your preferred name)
5. Region: `us-east-2` (or closest to your users)
6. Database password: Generate a strong password and **save it somewhere safe**
7. Wait for project status to change to "ACTIVE" (typically 2-3 minutes)

## Step 2: Apply Database Schema

1. Go to your "spitzone" project: https://wnehpqxrniobrccrvclj.supabase.co
2. In the left sidebar, click **SQL Editor**
3. Click **"New Query"**
4. Open `battlearena/battle-arena-migration-dump.sql` in a text editor
5. Copy the entire content (approx 1012 lines)
6. Paste into the SQL Editor
7. Click **"Run"** (should take 30-60 seconds)
8. Verify no errors in the output
9. You should see "Success" message with all tables created

## Step 3: Import Data

1. In the same SQL Editor, open a **new query**
2. Open `battle-arena-full-data.sql` in a text editor
3. Copy the entire content
4. Paste into the SQL Editor
5. Click **"Run"**
6. Verify no errors

**Alternative:** If the file is too large for the SQL Editor, use the Supabase CLI:
```bash
# Install CLI
npm install -g supabase

# Login to Supabase
supabase login

# Import data
supabase db reset --db-url "postgresql://postgres:[YOUR_PASSWORD]@db.[YOUR_PROJECT_REF].supabase.co:5432/postgres" -f battle-arena-full-data.sql
```

## Step 4: Get Your New Credentials

In your "spitzone" project dashboard:

1. **Project URL:** https://wnehpqxrniobrccrvclj.supabase.co
2. **Anon Key:** Go to Settings → API → anon/public key
3. **Service Role Key:** Go to Settings → API → service_role key (keep secret!)
4. **Database URL:** Go to Settings → Database → Connection string (URI format)
   - Should look like: `postgresql://postgres:[YOUR_PASSWORD]@db.wnehpqxrniobrccrvclj.supabase.co:5432/postgres`

## Step 5: Update Application Configuration

1. Open `.env.local` in the battlearena project root
2. Replace the Supabase credentials with your new ones:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://wnehpqxrniobrccrvclj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-new-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-new-service-role-key

# Database Configuration
DATABASE_URL=postgresql://postgres:your-db-password@db.wnehpqxrniobrccrvclj.supabase.co:5432/postgres
```

3. **Keep or update other environment variables:**
   - Stripe keys (if you have a Stripe account, update these)
   - LiveKit credentials (if you have a LiveKit instance)
   - Email configuration (if using SMTP)

## Step 6: Verify the Migration

Run these checks in your new project's SQL Editor:

```sql
-- Check users
SELECT COUNT(*) FROM users;  -- Should be 107

-- Check beats
SELECT COUNT(*) FROM beats;  -- Should be 78

-- Check battles
SELECT COUNT(*) FROM battles;  -- Should be 5

-- Check crews
SELECT COUNT(*) FROM crews;  -- Should be 15
```

## Step 7: Test the Application

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000

3. Test login with one of the migrated user accounts:
   - You'll need to reset passwords since Supabase doesn't export password hashes
   - Go to Supabase Dashboard → Authentication → Users
   - Click on a user → "Reset Password"
   - Set a new password and test login

## Important Notes

### Password Reset Required
- Supabase does not export password hashes for security
- You'll need to reset passwords for all users
- Consider implementing a password reset flow or creating new admin accounts

### File Storage
- Beat files are stored in Supabase Storage with public URLs
- The `beats` table contains `file_url` and `preview_url` references
- **These URLs will break** because they point to the old project
- You have two options:
  1. Re-upload beats to the new project's Storage bucket
  2. Update the URLs in the `beats` table after re-uploading

### Auth Provider
- If you're using email/password auth, the users are migrated but passwords need reset
- If using OAuth (Google, GitHub, etc.), the connections will need to be re-established

### RLS Policies
- Row Level Security policies are included in the migration dump
- Verify they work correctly with your new project's auth configuration

## Optional: Clean Up Old Data

If you want to remove test data before going live:

```sql
-- Remove test battles
DELETE FROM battles WHERE created_at < '2026-04-01';

-- Remove telemetry events
DELETE FROM telemetry_events;

-- Clear matchmaking queue
DELETE FROM matchmaking_queue;
```

## Support

If you encounter issues:

1. Check Supabase logs: Dashboard → Logs
2. Verify all tables were created: Database → Tables
3. Check RLS policies: Database → Tables → [Table] → RLS Policies
4. Test API connectivity using the Supabase REST API documentation

## Next Steps After Migration

1. **Set up email provider** for password resets (Supabase Dashboard → Authentication → Email Templates)
2. **Configure LiveKit** if using video battles
3. **Set up Stripe** for payments
4. **Configure custom domain** in Supabase if needed
5. **Enable backups** in Supabase Dashboard
6. **Set up monitoring** for production

---

**Transfer Complete!** Your Battle Arena application is now running on your own Supabase project.
