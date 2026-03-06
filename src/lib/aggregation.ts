interface WeeklyEntry {
  user_id: string;
  template_id: string;
  actual_value: number;
}

interface TemplateInfo {
  id: string;
  formula_type: 'higher_better' | 'lower_better';
}

export interface AggregatedResult {
  template_id: string;
  actual_value: number;
  weeks_filled: number;
}

/**
 * Aggregate weekly KPI entries into monthly actuals for a single user.
 * - higher_better: SUM of all weekly actual_values
 * - lower_better: AVERAGE of filled weeks only
 */
export function aggregateWeeklyToMonthly(
  weeklyEntries: WeeklyEntry[],
  templates: TemplateInfo[]
): AggregatedResult[] {
  return templates.map((template) => {
    const values = weeklyEntries
      .filter((e) => e.template_id === template.id)
      .map((e) => Number(e.actual_value));

    const weeksFilled = values.length;

    let actual: number;
    if (weeksFilled === 0) {
      actual = 0;
    } else if (template.formula_type === 'higher_better') {
      actual = values.reduce((sum, v) => sum + v, 0);
    } else {
      actual = values.reduce((sum, v) => sum + v, 0) / weeksFilled;
    }

    return {
      template_id: template.id,
      actual_value: Math.round(actual * 100) / 100,
      weeks_filled: weeksFilled,
    };
  });
}

/**
 * Pre-compute aggregated actuals for multiple users at once.
 * Returns a map: userId -> templateId -> actual_value
 */
export function aggregateAllUsers(
  allWeeklyEntries: WeeklyEntry[],
  templates: TemplateInfo[],
  userIds: string[]
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};

  for (const userId of userIds) {
    const userEntries = allWeeklyEntries.filter((e) => e.user_id === userId);
    const aggregated = aggregateWeeklyToMonthly(userEntries, templates);
    const map: Record<string, number> = {};
    for (const a of aggregated) {
      map[a.template_id] = a.actual_value;
    }
    result[userId] = map;
  }

  return result;
}

/**
 * Compute rate value for a rate KPI.
 * Rate = rawValue / denominator_actual (plain ratio)
 * rawValue is the rate KPI's own stored actual (user input).
 */
export function computeRateActual(
  rawValue: number,
  denominatorTemplateId: string,
  getActual: (templateId: string) => number
): number {
  const denominator = getActual(denominatorTemplateId);
  if (denominator === 0) return 0;
  return Math.round((rawValue / denominator) * 100) / 100;
}

/**
 * Check if a template is a rate KPI (has a denominator linked).
 */
export function isRateKpi(template: { denominator_template_id?: string | null }): boolean {
  return !!template.denominator_template_id;
}
