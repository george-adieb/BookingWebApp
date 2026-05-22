-- ============================================================
-- Migration: Add Abo Talat booking columns to booking_requests
-- Date: 2026-05-22
-- Safe: only ADD COLUMN IF NOT EXISTS with DEFAULT NULL
--       No existing rows or columns are modified.
-- ============================================================

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS booking_category       text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS abo_talat_booking_type text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS check_in_date          date    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS check_out_date         date    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS check_out_period       text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS facilities             text[]  DEFAULT NULL;

-- Check constraints (all allow NULL so existing rows are unaffected)
ALTER TABLE booking_requests
  DROP CONSTRAINT IF EXISTS chk_booking_category;
ALTER TABLE booking_requests
  ADD CONSTRAINT chk_booking_category
  CHECK (booking_category IS NULL OR booking_category IN ('church_place', 'abo_talat'));

ALTER TABLE booking_requests
  DROP CONSTRAINT IF EXISTS chk_abo_talat_booking_type;
ALTER TABLE booking_requests
  ADD CONSTRAINT chk_abo_talat_booking_type
  CHECK (abo_talat_booking_type IS NULL OR abo_talat_booking_type IN ('one_day', 'retreat'));

ALTER TABLE booking_requests
  DROP CONSTRAINT IF EXISTS chk_check_out_period;
ALTER TABLE booking_requests
  ADD CONSTRAINT chk_check_out_period
  CHECK (check_out_period IS NULL OR check_out_period IN ('morning', 'evening'));

-- ── New RPC: check_abo_talat_availability ─────────────────────────────────────
-- Does NOT touch the existing check_place_availability function.
CREATE OR REPLACE FUNCTION check_abo_talat_availability(
  p_booking_type   text,
  p_date           date DEFAULT NULL,
  p_start_time     time DEFAULT NULL,
  p_end_time       time DEFAULT NULL,
  p_check_in_date  date DEFAULT NULL,
  p_check_out_date date DEFAULT NULL,
  p_exclude_id     uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  conflict_count integer;
BEGIN
  IF p_booking_type = 'one_day' THEN
    SELECT COUNT(*) INTO conflict_count
    FROM booking_requests
    WHERE booking_category = 'abo_talat'
      AND status = 'approved'
      AND (p_exclude_id IS NULL OR id <> p_exclude_id)
      AND (
        -- Conflict: another one_day on same date with overlapping time
        (abo_talat_booking_type = 'one_day'
          AND booking_date = p_date
          AND start_time < p_end_time
          AND end_time > p_start_time)
        OR
        -- Conflict: an approved retreat that covers this date
        (abo_talat_booking_type = 'retreat'
          AND check_in_date <= p_date
          AND check_out_date >= p_date)
      );

  ELSIF p_booking_type = 'retreat' THEN
    SELECT COUNT(*) INTO conflict_count
    FROM booking_requests
    WHERE booking_category = 'abo_talat'
      AND status = 'approved'
      AND (p_exclude_id IS NULL OR id <> p_exclude_id)
      AND (
        -- Conflict: retreat date ranges overlap
        (abo_talat_booking_type = 'retreat'
          AND check_in_date <= p_check_out_date
          AND check_out_date >= p_check_in_date)
        OR
        -- Conflict: a one_day booking that falls inside this retreat's range
        (abo_talat_booking_type = 'one_day'
          AND booking_date >= p_check_in_date
          AND booking_date <= p_check_out_date)
      );
  ELSE
    RETURN true;
  END IF;

  RETURN conflict_count = 0;
END;
$$;
