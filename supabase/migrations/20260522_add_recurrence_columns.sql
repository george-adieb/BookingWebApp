-- ============================================================
-- Migration: Add recurring-booking columns to booking_requests
-- Date: 2026-05-22
-- Safe: only ADD COLUMN IF NOT EXISTS with DEFAULT NULL
--       No existing rows or columns are modified.
-- ============================================================

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS recurrence_group_id uuid    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_type     text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_count    integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_until    date    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS occurrence_number   integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_occurrences   integer DEFAULT NULL;

-- Constraint: recurrence_type must be one of the allowed values (or NULL for old rows)
ALTER TABLE booking_requests
  DROP CONSTRAINT IF EXISTS booking_requests_recurrence_type_check;

ALTER TABLE booking_requests
  ADD CONSTRAINT booking_requests_recurrence_type_check
  CHECK (recurrence_type IS NULL OR recurrence_type IN ('none', 'weekly', 'monthly'));

-- Index to quickly fetch all occurrences of a recurring group
CREATE INDEX IF NOT EXISTS idx_booking_requests_recurrence_group_id
  ON booking_requests (recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;
