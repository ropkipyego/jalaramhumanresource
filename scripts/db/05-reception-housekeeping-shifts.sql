-- Reception + housekeeping timed shifts (Jalaram HR Phase 1).
-- Used by rota_assignments.shift_template_id → compute_attendance_range (late / OT).
-- Safe to re-run.

INSERT INTO public.shift_templates (
  name, code, start_time, end_time, crosses_midnight, expected_hours,
  grace_before_min, grace_after_min, meal_break_minutes, min_ot_minutes, ot_round_minutes,
  is_night, is_active
) VALUES
  (
    'Reception / HK Day 06:30–14:30', 'RH_D0630_1430',
    '06:30', '14:30', false, 8,
    10, 10, 0, 30, 15,
    false, true
  ),
  (
    'Reception / HK Day 08:00–16:00', 'RH_D0800_1600',
    '08:00', '16:00', false, 8,
    10, 10, 0, 30, 15,
    false, true
  ),
  (
    'Reception / HK Day 10:30–18:30', 'RH_D1030_1830',
    '10:30', '18:30', false, 8,
    10, 10, 0, 30, 15,
    false, true
  ),
  (
    'Reception / HK Night 18:30–06:30', 'RH_N1830_0630',
    '18:30', '06:30', true, 12,
    10, 10, 30, 30, 15,
    true, true
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  crosses_midnight = EXCLUDED.crosses_midnight,
  expected_hours = EXCLUDED.expected_hours,
  grace_before_min = EXCLUDED.grace_before_min,
  grace_after_min = EXCLUDED.grace_after_min,
  meal_break_minutes = EXCLUDED.meal_break_minutes,
  is_night = EXCLUDED.is_night,
  is_active = true;

-- Legacy timed codes (keep aligned for Excel "D 6:30AM" matching)
INSERT INTO public.shift_templates (
  name, code, start_time, end_time, crosses_midnight, expected_hours,
  grace_before_min, grace_after_min, meal_break_minutes, is_night, is_active
) VALUES
  ('Day 06:30 (legacy)', 'DAY_0630', '06:30', '14:30', false, 8, 10, 10, 0, false, true),
  ('Day 08:00 (legacy)', 'DAY_0800', '08:00', '16:00', false, 8, 10, 10, 0, false, true),
  ('Day 10:30 (legacy)', 'DAY_1030', '10:30', '18:30', false, 8, 10, 10, 0, false, true),
  ('Night 18:30 (legacy)', 'NIGHT_1830', '18:30', '06:30', true, 12, 10, 10, 30, true, true)
ON CONFLICT (code) DO UPDATE SET
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  expected_hours = EXCLUDED.expected_hours,
  crosses_midnight = EXCLUDED.crosses_midnight,
  is_night = EXCLUDED.is_night,
  is_active = true;

COMMENT ON TABLE public.shift_templates IS
  'Reception/housekeeping: link via rota_assignments.shift_template_id for accurate late & OT.';
