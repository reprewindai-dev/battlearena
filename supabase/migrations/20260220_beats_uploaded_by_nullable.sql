-- Make uploaded_by optional to allow system ingestion when auth user is unavailable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'beats' AND column_name = 'uploaded_by'
  ) THEN
    ALTER TABLE public.beats ALTER COLUMN uploaded_by DROP NOT NULL;
    -- Drop FK if exists
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      WHERE tc.table_schema='public' AND tc.table_name='beats' AND tc.constraint_type='FOREIGN KEY'
    ) THEN
      ALTER TABLE public.beats DROP CONSTRAINT IF EXISTS beats_uploaded_by_fkey;
    END IF;
  END IF;
END $$;
