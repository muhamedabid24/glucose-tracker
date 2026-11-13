BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weight NUMERIC(5,2);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='users'::regclass AND conname='users_profile_age_check') THEN
  ALTER TABLE users ADD CONSTRAINT users_profile_age_check CHECK (age IS NULL OR age BETWEEN 0 AND 130);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='users'::regclass AND conname='users_profile_weight_check') THEN
  ALTER TABLE users ADD CONSTRAINT users_profile_weight_check CHECK (weight IS NULL OR (weight > 0 AND weight <= 500));
 END IF;
END $$;
COMMIT;
