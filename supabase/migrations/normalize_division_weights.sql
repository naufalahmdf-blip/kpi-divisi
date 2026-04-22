-- ═══════════════════════════════════════════════════════════════════════
-- MIGRATION: Normalisasi bobot KPI template per divisi → sum 100%
-- Konteks: sistem scoring baru (max 100, KPI × 0.95 + Lateness 5)
-- mengandalkan bobot template tiap divisi sum = 100. Dua divisi off:
--   • Visual Creative  105% → 100%
--   • Web Developer     95% → 100%
-- Dan juga terlambat berubah makna: jumlah hari → total menit per bulan
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Visual Creative: 35 + 30 + 20 + 20 = 105 → 33 + 29 + 19 + 19 = 100
UPDATE kpi_templates SET weight = 33
 WHERE division_id = (SELECT id FROM divisions WHERE slug = 'visual-creative')
   AND kpi_name = 'Total Design Output (Monthly)';
UPDATE kpi_templates SET weight = 29
 WHERE division_id = (SELECT id FROM divisions WHERE slug = 'visual-creative')
   AND kpi_name = 'On-Time Delivery Rate (%)';
UPDATE kpi_templates SET weight = 19
 WHERE division_id = (SELECT id FROM divisions WHERE slug = 'visual-creative')
   AND kpi_name = 'Technical Errors (Target 0)';
UPDATE kpi_templates SET weight = 19
 WHERE division_id = (SELECT id FROM divisions WHERE slug = 'visual-creative')
   AND kpi_name = 'New Exploration (Monthly)';

-- ─── Web Developer: 40 + 25 + 15 + 15 = 95 → 42 + 26 + 16 + 16 = 100
UPDATE kpi_templates SET weight = 42
 WHERE division_id = (SELECT id FROM divisions WHERE slug = 'web-developer')
   AND kpi_name = 'Task Delivery Speed';
UPDATE kpi_templates SET weight = 26
 WHERE division_id = (SELECT id FROM divisions WHERE slug = 'web-developer')
   AND kpi_name = 'Release Quality Control (QC)';
UPDATE kpi_templates SET weight = 16
 WHERE division_id = (SELECT id FROM divisions WHERE slug = 'web-developer')
   AND kpi_name = 'Security & Backup';
UPDATE kpi_templates SET weight = 16
 WHERE division_id = (SELECT id FROM divisions WHERE slug = 'web-developer')
   AND kpi_name = 'Documentation & Version Control';

-- ─── Comment semantic change: terlambat sekarang dalam MENIT, bukan hari
COMMENT ON COLUMN attendance_entries.terlambat IS 'Total menit keterlambatan akumulatif per bulan (toleransi 60 menit)';

-- Sanity check: pastikan semua divisi aktif sum bobot = 100
DO $$
DECLARE
  div_record RECORD;
  total_weight INT;
BEGIN
  FOR div_record IN
    SELECT d.id, d.name FROM divisions d
    WHERE EXISTS (SELECT 1 FROM kpi_templates t WHERE t.division_id = d.id)
  LOOP
    SELECT COALESCE(SUM(weight), 0) INTO total_weight
    FROM kpi_templates WHERE division_id = div_record.id;
    IF total_weight != 100 THEN
      RAISE WARNING 'Divisi % masih punya bobot sum = %', div_record.name, total_weight;
    END IF;
  END LOOP;
END $$;

COMMIT;

SELECT 'Weights normalized & terlambat semantics updated' AS status;
