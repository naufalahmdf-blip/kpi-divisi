-- ============================================================
-- MIGRATION: Add KPI Templates for Research Division
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Ensure Research division exists (safe if already added via UI)
INSERT INTO divisions (name, slug)
VALUES ('Research', 'research')
ON CONFLICT (slug) DO NOTHING;

-- Step 2: Insert KPI templates for Research
-- Only inserts if the division currently has no templates (idempotent)
INSERT INTO kpi_templates (division_id, category, kpi_name, weight, target, unit, formula_type, sort_order)
SELECT d.id, v.category, v.kpi_name, v.weight, v.target, v.unit, v.formula_type, v.sort_order
FROM divisions d
CROSS JOIN (VALUES
  -- KPI 1 | Productivity | 20% | Target: 12 summaries/month (3/week)
  ('Productivity'::text, 'Weekly Macro Summary'::text,    20::numeric, 12::numeric, 'Summary'::text,    'higher_better'::text, 1::int),
  -- KPI 2 | Productivity | 15% | Target: 4 reports/month (1/week)
  ('Productivity',       'Crypto Monday Deep Dive',       15,           4,           'Report',           'higher_better',       2),
  -- KPI 3 | Productivity | 30% | Target: 20 newsletters/month (1/weekday)
  ('Productivity',       'Daily Newsletter',              30,          20,           'Newsletter',       'higher_better',       3),
  -- KPI 4 | Quality      | 20% | Target: ≤25% revision rate (lower = better)
  ('Quality',            'Revision Rate',                 20,          25,           '%',                'lower_better',        4),
  -- KPI 5 | Accuracy     | 15% | Target: ≤3 typos/month (lower = better)
  ('Accuracy',           'Minor Typo Control',            15,           3,           'Typo',             'lower_better',        5)
) AS v(category, kpi_name, weight, target, unit, formula_type, sort_order)
WHERE d.slug = 'research'
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
WHERE d.slug = 'research'
ORDER BY kt.sort_order;
