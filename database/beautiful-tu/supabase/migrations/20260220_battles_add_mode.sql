-- Add mode column to battles for matchmaking compatibility
ALTER TABLE battles
    ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'freestyle';

-- Backfill existing rows
UPDATE battles SET mode = 'freestyle' WHERE mode IS NULL;

-- Optional constraint for mode domain
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'battles_mode_check'
    ) THEN
        ALTER TABLE battles
        ADD CONSTRAINT battles_mode_check CHECK (mode IN ('freestyle','ranked','casual','tournament'));
    END IF;
END $$;
