export interface Division {
  id: string;
  name: string;
  slug: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  division_id: string | null;
  is_active: boolean;
  avatar_url?: string;
  divisions?: Division;
}

export interface KpiTemplate {
  id: string;
  division_id: string;
  category: string;
  kpi_name: string;
  weight: number;
  target: number;
  unit: string;
  formula_type: 'higher_better' | 'lower_better';
  sort_order: number;
}

export interface KpiEntry {
  id: string;
  user_id: string;
  template_id: string;
  period_type: 'weekly' | 'monthly';
  year: number;
  month: number;
  week: number | null;
  actual_value: number;
  notes: string | null;
}

export interface KpiWithTemplate extends KpiEntry {
  kpi_templates: KpiTemplate;
}

export interface KpiScore {
  template: KpiTemplate;
  entry: KpiEntry | null;
  actual: number;
  achievement: number;
  weightedScore: number;
}

export interface UserKpiSummary {
  user: User;
  scores: KpiScore[];
  totalScore: number;
  grade: string;
}

export interface DivisionKpiSummary {
  division: Division;
  averageScore: number;
  grade: string;
  userCount: number;
}
