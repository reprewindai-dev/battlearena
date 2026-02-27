CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Complete Supabase auth schema
CREATE TABLE IF NOT EXISTS auth.users (
    instance_id uuid NULL,
    id uuid NOT NULL UNIQUE,
    aud varchar(255) NULL,
    "role" varchar(255) NULL,
    email varchar(255) NULL UNIQUE,
    encrypted_password varchar(255) NULL,
    confirmed_at timestamptz NULL,
    invited_at timestamptz NULL,
    confirmation_token varchar(255) NULL,
    confirmation_sent_at timestamptz NULL,
    recovery_token varchar(255) NULL,
    recovery_sent_at timestamptz NULL,
    email_change_token varchar(255) NULL,
    email_change varchar(255) NULL,
    email_change_sent_at timestamptz NULL,
    last_sign_in_at timestamptz NULL,
    raw_app_meta_data jsonb NULL,
    raw_user_meta_data jsonb NULL,
    is_super_admin bool NULL,
    created_at timestamptz NULL,
    updated_at timestamptz NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS users_instance_id_email_idx ON auth.users USING btree (instance_id, email);
CREATE INDEX IF NOT EXISTS users_instance_id_idx ON auth.users USING btree (instance_id);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    instance_id uuid NULL,
    id bigserial NOT NULL,
    "token" varchar(255) NULL,
    user_id varchar(255) NULL,
    revoked bool NULL,
    created_at timestamptz NULL,
    updated_at timestamptz NULL,
    CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON auth.refresh_tokens USING btree (token);

CREATE TABLE IF NOT EXISTS auth.instances (
    id uuid NOT NULL,
    uuid uuid NULL,
    raw_base_config text NULL,
    created_at timestamptz NULL,
    updated_at timestamptz NULL,
    CONSTRAINT instances_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS auth.audit_log_entries (
    instance_id uuid NULL,
    id uuid NOT NULL,
    payload json NULL,
    created_at timestamptz NULL,
    CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);

CREATE TABLE IF NOT EXISTS auth.schema_migrations (
    "version" varchar(255) NOT NULL,
    CONSTRAINT schema_migrations_pkey PRIMARY KEY ("version")
);

-- Auth functions
create or replace function auth.uid() returns uuid as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ language sql stable;

create or replace function auth.role() returns text as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')::text;
$$ language sql stable;

-- Insert default instance
INSERT INTO auth.instances (id, uuid, created_at, updated_at) 
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
