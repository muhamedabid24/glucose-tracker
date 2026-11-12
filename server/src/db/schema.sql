BEGIN;
CREATE TABLE IF NOT EXISTS users (
 id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS readings (
 id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 reading_date DATE NOT NULL, slot VARCHAR(30) NOT NULL, value_mg_dl INTEGER NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='readings'::regclass AND conname='valid_slot') THEN
 ALTER TABLE readings ADD CONSTRAINT valid_slot CHECK (slot IN ('Morning (fasting)', 'After breakfast', 'After lunch', 'After dinner'));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='readings'::regclass AND conname='valid_glucose') THEN
 ALTER TABLE readings ADD CONSTRAINT valid_glucose CHECK (value_mg_dl BETWEEN 40 AND 600);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='readings'::regclass AND conname='unique_daily_slot') THEN
 ALTER TABLE readings ADD CONSTRAINT unique_daily_slot UNIQUE (user_id, reading_date, slot);
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_unique ON users (lower(email));
COMMIT;
