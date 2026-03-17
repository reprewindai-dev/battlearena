import pg from 'pg';

const { Client } = pg;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function createPaymentSchema() {
  const client = new Client({
    host: requiredEnv('SUPABASE_DB_HOST'),
    port: Number(process.env.SUPABASE_DB_PORT ?? '6543'),
    database: process.env.SUPABASE_DB_NAME ?? 'postgres',
    user: requiredEnv('SUPABASE_DB_USER'),
    password: requiredEnv('SUPABASE_DB_PASSWORD'),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    query_timeout: 30000
  });

  try {
    await client.connect();
    console.log('🔌 Connected to Supabase PostgreSQL');

    // Create payment schema
    const schema = `
-- Payment ledger for tracking all transactions
CREATE TABLE IF NOT EXISTS public.payment_ledger (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.users(id),
    stripe_payment_intent_id varchar(255),
    amount_cents integer NOT NULL,
    currency varchar(3) DEFAULT 'usd',
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    payment_type varchar(20) NOT NULL CHECK (payment_type IN ('entry_fee', 'purchase', 'refund')),
    description text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- User balances
CREATE TABLE IF NOT EXISTS public.user_balances (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid UNIQUE NOT NULL REFERENCES public.users(id),
    balance_cents integer DEFAULT 0,
    total_spent_cents integer DEFAULT 0,
    total_earned_cents integer DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.users(id),
    type varchar(20) NOT NULL CHECK (type IN ('credit', 'debit')),
    amount_cents integer NOT NULL,
    balance_after_cents integer NOT NULL,
    source varchar(50) NOT NULL,
    reference_id uuid,
    description text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS payment_ledger_user_idx ON public.payment_ledger(user_id);
CREATE INDEX IF NOT EXISTS payment_ledger_status_idx ON public.payment_ledger(status);
CREATE INDEX IF NOT EXISTS payment_ledger_payment_intent_idx ON public.payment_ledger(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS user_balances_user_idx ON public.user_balances(user_id);

CREATE INDEX IF NOT EXISTS transactions_user_idx ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS transactions_type_idx ON public.transactions(type);
CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON public.transactions(created_at);

-- Functions
CREATE OR REPLACE FUNCTION public.update_user_balance(p_user_id uuid, p_amount_cents integer, p_type varchar(20))
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_balance integer;
BEGIN
  -- Get or create user balance record
  INSERT INTO public.user_balances (user_id, balance_cents)
  VALUES (p_user_id, p_amount_cents)
  ON CONFLICT (user_id) DO UPDATE SET
    balance_cents = public.user_balances.balance_cents + p_amount_cents,
    updated_at = now()
  RETURNING balance_cents INTO current_balance;
  
  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount_cents, balance_after_cents, source, description)
  VALUES (p_user_id, p_type, p_amount_cents, current_balance, 'payment', 'Balance update');
END;
$$;

-- RLS policies
ALTER TABLE public.payment_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment records
CREATE POLICY "Users can view own payment ledger" ON public.payment_ledger
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own balance" ON public.user_balances
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON public.transactions
    FOR SELECT USING (auth.uid() = user_id);
`;

    await client.query(schema);
    console.log('✅ Payment schema created successfully');

    await client.end();
    console.log('🔌 Disconnected cleanly');
  } catch (err) {
    console.error('❌ Payment schema creation failed:', err.message);
    process.exit(1);
  }
}

createPaymentSchema();
