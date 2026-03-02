-- ============================================================
-- MIGRATION: Add KPI Templates for Web Developer Division
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Ensure Web Developer division exists (safe if already added via UI)
INSERT INTO divisions (name, slug)
VALUES ('Web Developer', 'web-developer')
ON CONFLICT (slug) DO NOTHING;

-- Step 2: Insert KPI templates for Web Developer
-- Only inserts if the division currently has no templates (idempotent)
INSERT INTO kpi_templates (division_id, category, kpi_name, weight, target, unit, formula_type, sort_order)
SELECT d.id, v.category, v.kpi_name, v.weight, v.target, v.unit, v.formula_type, v.sort_order
FROM divisions d
CROSS JOIN (VALUES
  -- KPI 1 | Productivity | 40% | Target: 90% on-time task delivery rate
  ('Productivity'::text, 'Task Delivery Speed'::text,             40::numeric, 90::numeric, '%'::text,         'higher_better'::text, 1::int),
  -- KPI 2 | Quality      | 30% | Target: 0 preventable bugs (lower = better, 0 = perfect)
  ('Quality',            'Release Quality Control (QC)',          30,           0,           'Bug',             'lower_better',        2),
  -- KPI 3 | Security     | 15% | Target: 4 security/backup checklists per month
  ('Security',           'Security & Backup',                     15,           4,           'Checklist',       'higher_better',       3),
  -- KPI 4 | Quality      | 15% | Target: 4 documentation/version-control compliance per month
  ('Quality',            'Documentation & Version Control',       15,           4,           'Checklist',       'higher_better',       4)
) AS v(category, kpi_name, weight, target, unit, formula_type, sort_order)
WHERE d.slug = 'web-developer'
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
WHERE d.slug = 'web-developer'
ORDER BY kt.sort_order;
