-- ============================================================
-- MIGRATION: Add attendance_entries table
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Create table (idempotent)
CREATE TABLE IF NOT EXISTS attendance_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  hari_kerja INT NOT NULL DEFAULT 0,
  hadir INT NOT NULL DEFAULT 0,
  terlambat INT NOT NULL DEFAULT 0,
  sakit INT NOT NULL DEFAULT 0,
  cuti INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

-- Step 2: Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_period ON attendance_entries(year, month);

-- Step 3: RLS
ALTER TABLE attendance_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'attendance_entries'
      AND policyname = 'Allow all for service role'
  ) THEN
    CREATE POLICY "Allow all for service role" ON attendance_entries FOR ALL USING (true);
  END IF;
END $$;

-- Verify
SELECT 'attendance_entries table created successfully' AS status;
