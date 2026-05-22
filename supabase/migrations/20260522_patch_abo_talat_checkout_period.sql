-- ============================================================
-- Migration: Update check_abo_talat_availability RPC
-- Date: 2026-05-22 (patch)
-- Adds p_check_out_period parameter so retreat availability
-- correctly respects morning vs evening checkout.
-- Safe: uses CREATE OR REPLACE, no table changes.
-- ============================================================

CREATE OR REPLACE FUNCTION check_abo_talat_availability(
  p_booking_type    text,
  p_date            date    DEFAULT NULL,   -- one_day: booking_date
  p_start_time      time    DEFAULT NULL,   -- one_day: start_time
  p_end_time        time    DEFAULT NULL,   -- one_day: end_time
  p_check_in_date   date    DEFAULT NULL,   -- retreat: check_in_date
  p_check_out_date  date    DEFAULT NULL,   -- retreat: check_out_date
  p_check_out_period text   DEFAULT NULL,   -- retreat: 'morning' | 'evening'
  p_exclude_id      uuid    DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  conflict_count    integer;
  new_occupied_until date;   -- effective last blocked date for new request
BEGIN

  IF p_booking_type = 'one_day' THEN
    -- ── Conflict checks for a new ONE-DAY booking ─────────────────────────
    SELECT COUNT(*) INTO conflict_count
    FROM booking_requests
    WHERE booking_category = 'abo_talat'
      AND status = 'approved'
      AND (p_exclude_id IS NULL OR id <> p_exclude_id)
      AND (
        -- Conflict: another approved one_day on same date with overlapping time
        (abo_talat_booking_type = 'one_day'
          AND booking_date = p_date
          AND start_time < p_end_time
          AND end_time > p_start_time)

        OR

        -- Conflict: an approved retreat that blocks this date
        -- morning checkout → retreat does NOT block the checkout date
        -- evening checkout → retreat DOES block the checkout date
        (abo_talat_booking_type = 'retreat'
          AND check_in_date <= p_date
          AND (
            CASE
              WHEN check_out_period = 'morning' THEN check_out_date - INTERVAL '1 day'
              ELSE check_out_date
            END
          ) >= p_date)
      );

  ELSIF p_booking_type = 'retreat' THEN
    -- ── Calculate effective occupied end date for the NEW retreat ─────────
    new_occupied_until := CASE
      WHEN p_check_out_period = 'morning' THEN p_check_out_date - INTERVAL '1 day'
      ELSE p_check_out_date
    END;

    -- ── Conflict checks for a new RETREAT booking ─────────────────────────
    SELECT COUNT(*) INTO conflict_count
    FROM booking_requests
    WHERE booking_category = 'abo_talat'
      AND status = 'approved'
      AND (p_exclude_id IS NULL OR id <> p_exclude_id)
      AND (
        -- Conflict: existing retreat overlaps with the new retreat
        (abo_talat_booking_type = 'retreat'
          AND check_in_date <= new_occupied_until
          AND (
            CASE
              WHEN check_out_period = 'morning' THEN check_out_date - INTERVAL '1 day'
              ELSE check_out_date
            END
          ) >= p_check_in_date)

        OR

        -- Conflict: existing one_day falls inside the new retreat's blocked range
        (abo_talat_booking_type = 'one_day'
          AND booking_date >= p_check_in_date
          AND booking_date <= new_occupied_until)
      );

  ELSE
    RETURN true; -- unknown type: do not block
  END IF;

  RETURN conflict_count = 0;
END;
$$;
