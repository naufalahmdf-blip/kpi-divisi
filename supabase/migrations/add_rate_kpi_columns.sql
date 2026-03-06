-- Rate KPI support: link denominator template for auto rate calculation
-- Rate = (this KPI's actual / denominator's actual) × 100%

ALTER TABLE kpi_templates
  ADD COLUMN IF NOT EXISTS denominator_template_id UUID REFERENCES kpi_templates(id) ON DELETE SET NULL;

-- Clean up old numerator column if it exists
ALTER TABLE kpi_templates
  DROP COLUMN IF EXISTS numerator_template_id;
