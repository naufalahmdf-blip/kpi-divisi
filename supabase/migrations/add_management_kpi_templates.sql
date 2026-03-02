-- ============================================================
-- MIGRATION: Add KPI Templates for Management Division
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Ensure Management division exists (safe if already added via UI)
INSERT INTO divisions (name, slug)
VALUES ('Management', 'management')
ON CONFLICT (slug) DO NOTHING;

-- Step 2: Insert KPI templates for Management
-- Only inserts if the division currently has no templates (idempotent)
INSERT INTO kpi_templates (division_id, category, kpi_name, weight, target, unit, formula_type, sort_order)
SELECT d.id, v.category, v.kpi_name, v.weight, v.target, v.unit, v.formula_type, v.sort_order
FROM divisions d
CROSS JOIN (VALUES
  -- KPI 1 | Recruitment  | 15% | Target: ≤30 days avg time-to-hire (weighted avg across tiers)
  --        Tier A (General) ≤21d | Tier B (Skilled) ≤30d | Tier C (Specialized) ≤45-60d
  ('Recruitment'::text, 'Time-to-Hire'::text,                          15::numeric, 30::numeric, 'Day'::text,       'lower_better'::text,  1::int),
  -- KPI 2 | Recruitment  | 15% | Target: 0 failed probations per month
  --        New hire harus ≥70% KPI score dalam 60-90 hari, max 1 gagal/6 bulan
  ('Recruitment',       'Early Performance & Probation Control',        15,           0,           'Failed',          'lower_better',        2),
  -- KPI 3 | Retention    | 20% | Target: 0 unwanted high performer exit per month
  --        Jika 1 keluar → wajib root cause analysis report
  ('Retention',         'High Performer Retention',                     20,           0,           'Exit',            'lower_better',        3),
  -- KPI 4 | Compliance   | 15% | Target: 0 procedural/administrative errors
  --        Kontrak updated, SP documented, payroll 100% akurat, gaji on-time, absensi akurat
  ('Compliance',        'Discipline & Compliance',                      15,           0,           'Error',           'lower_better',        4),
  -- KPI 5 | Engagement   | 15% | Target: 100% completion rate 1-on-1 bulanan
  --        100% karyawan dapat 1-on-1 + min 3 HR independent check-in/bulan, semua documented
  ('Engagement',        'Monthly 1-on-1 Monitoring System',             15,         100,           '%',               'higher_better',       5),
  -- KPI 6 | Retention    | 10% | Target: 1 HR dashboard diterbitkan per bulan
  --        Dashboard berisi: dissatisfaction signals, high performer risk, exit risk rating
  ('Retention',         'Retention Risk Monitoring',                    10,           1,           'Dashboard',       'higher_better',       6),
  -- KPI 7 | Culture      | 10% | Target: 1 internal activity per bulan
  --        Min 1 aktivitas/bulan (townhall/training/sharing/bonding) + 1 dev initiative/kuartal
  ('Culture',           'Culture & Internal Activity Execution',        10,           1,           'Activity',        'higher_better',       7)
) AS v(category, kpi_name, weight, target, unit, formula_type, sort_order)
WHERE d.slug = 'management'
  AND NOT EXISTS (
    SELECT 1 FROM kpi_templates kt WHERE kt.division_id = d.id
  );

-- Verify result
SELECT
  kt.sort_order,
  kt.kpi_name,
  kt.category,
  kt.weight || '%'   AS bobot,
  kt.target          AS target,
  kt.unit,
  kt.formula_type
FROM kpi_templates kt
JOIN divisions d ON d.id = kt.division_id
WHERE d.slug = 'management'
ORDER BY kt.sort_order;
