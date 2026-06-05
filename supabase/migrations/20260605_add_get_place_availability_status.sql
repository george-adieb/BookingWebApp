-- ============================================================
-- Migration: Add get_place_availability_status RPC
-- Date: 2026-06-05
-- Safe: READ-ONLY function. Does NOT modify any existing data,
--       tables, or the existing check_place_availability function.
-- ============================================================

-- Drop if exists so we can safely re-run
DROP FUNCTION IF EXISTS get_place_availability_status(uuid, date, time, time, uuid);

CREATE OR REPLACE FUNCTION get_place_availability_status(
  p_place_id   uuid,
  p_date       date,
  p_start_time time,
  p_end_time   time,
  p_exclude_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status    text := 'available';
  v_conflicts jsonb := '[]'::jsonb;
  v_row       record;
BEGIN
  -- Scan all booking_request_places entries for this place/date
  -- that have a time-overlapping booking_request (pending or approved)
  FOR v_row IN
    SELECT
      br.id,
      br.booking_date,
      br.status,
      br.requester_name,
      br.service_name,
      br.start_time,
      br.end_time
    FROM booking_request_places brp
    JOIN booking_requests br ON br.id = brp.booking_request_id
    WHERE brp.place_id = p_place_id
      AND br.booking_date = p_date
      AND br.status IN ('pending', 'approved')
      AND (p_exclude_id IS NULL OR br.id <> p_exclude_id)
      -- Time overlap: new_start < existing_end AND new_end > existing_start
      AND br.start_time < p_end_time
      AND br.end_time   > p_start_time
    ORDER BY
      -- approved first so they appear at the top of conflicts list
      CASE br.status WHEN 'approved' THEN 0 ELSE 1 END,
      br.start_time
  LOOP
    -- Accumulate conflict details
    v_conflicts := v_conflicts || jsonb_build_object(
      'date',           v_row.booking_date,
      'status',         v_row.status,
      'requester_name', v_row.requester_name,
      'service_name',   v_row.service_name,
      'start_time',     v_row.start_time,
      'end_time',       v_row.end_time
    );

    -- Status priority: approved conflict wins over pending
    IF v_row.status = 'approved' THEN
      v_status := 'booked';
    ELSIF v_row.status = 'pending' AND v_status = 'available' THEN
      v_status := 'pending';
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'status',    v_status,
    'conflicts', v_conflicts
  );
END;
$$;

-- Grant execute to anon and authenticated roles (same as other booking RPCs)
GRANT EXECUTE ON FUNCTION get_place_availability_status(uuid, date, time, time, uuid)
  TO anon, authenticated;
