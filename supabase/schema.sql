-- ============================================
-- KPI DIVISI DATABASE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. DIVISIONS TABLE
-- ============================================
CREATE TABLE divisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  trello_board_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. USERS TABLE
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  division_id UUID REFERENCES divisions(id) ON DELETE SET NULL,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. KPI TEMPLATES TABLE
-- Each division has its own KPI structure
-- ============================================
CREATE TABLE kpi_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  kpi_name TEXT NOT NULL,
  weight NUMERIC(5,2) NOT NULL,
  target NUMERIC(15,4) NOT NULL,
  unit TEXT NOT NULL,
  formula_type TEXT NOT NULL DEFAULT 'higher_better' CHECK (formula_type IN ('higher_better', 'lower_better')),
  denominator_template_id UUID REFERENCES kpi_templates(id) ON DELETE SET NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. KPI ENTRIES TABLE
-- Stores actual KPI values per user per period
-- ============================================
CREATE TABLE kpi_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES kpi_templates(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  week INT CHECK (week BETWEEN 1 AND 5),
  actual_value NUMERIC(15,4) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, template_id, period_type, year, month, week)
);

-- ============================================
-- 5. ATTENDANCE ENTRIES TABLE
-- Monthly attendance summary per user
-- ============================================
CREATE TABLE attendance_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  hari_kerja INT NOT NULL DEFAULT 0,
  hadir INT NOT NULL DEFAULT 0,
  terlambat INT NOT NULL DEFAULT 0,
  sakit INT NOT NULL DEFAULT 0,
  cuti INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

-- ============================================
-- 6. SESSIONS TABLE (for auth)
-- ============================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_users_division ON users(division_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_kpi_templates_division ON kpi_templates(division_id);
CREATE INDEX idx_kpi_entries_user ON kpi_entries(user_id);
CREATE INDEX idx_kpi_entries_period ON kpi_entries(period_type, year, month);
CREATE INDEX idx_kpi_entries_template ON kpi_entries(template_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_attendance_user ON attendance_entries(user_id);
CREATE INDEX idx_attendance_period ON attendance_entries(year, month);

-- ============================================
-- SEED: DIVISIONS
-- ============================================
INSERT INTO divisions (name, slug) VALUES
  ('Visual Creative', 'visual-creative'),
  ('Video Editor', 'video-editor'),
  ('Sales', 'sales'),
  ('Community', 'community'),
  ('Creative', 'creative'),
  ('Research', 'research'),
  ('Web Developer', 'web-developer'),
  ('Management', 'management');

-- ============================================
-- SEED: KPI TEMPLATES
-- ============================================

-- Visual Creative
INSERT INTO kpi_templates (division_id, category, kpi_name, weight, target, unit, formula_type, sort_order)
SELECT d.id, v.category, v.kpi_name, v.weight, v.target, v.unit, v.formula_type, v.sort_order
FROM divisions d
CROSS JOIN (VALUES
  ('Productivity', 'Total Design Output (Monthly)', 30, 90, 'Design', 'higher_better', 1),
  ('Productivity', 'On-Time Delivery Rate (%)', 20, 30, 'Percentage %', 'higher_better', 2),
  ('Efficiency', 'Average Revision per Design (≤2)', 10, 1, 'Revision', 'lower_better', 3),
  ('Quality', 'Technical Errors (Target 0)', 15, 1, 'Errors', 'lower_better', 4),
  ('Creative Development', 'New Exploration (Monthly)', 25, 4, 'Ideas', 'higher_better', 5)
) AS v(category, kpi_name, weight, target, unit, formula_type, sort_order)
WHERE d.slug = 'visual-creative';

-- Video Editor
INSERT INTO kpi_templates (division_id, category, kpi_name, weight, target, unit, formula_type, sort_order)
SELECT d.id, v.category, v.kpi_name, v.weight, v.target, v.unit, v.formula_type, v.sort_order
FROM divisions d
CROSS JOIN (VALUES
  ('Productivity', 'Total Design Output', 30, 120, 'Point', 'higher_better', 1),
  ('Productivity', 'On-Time Delivery Rate', 20, 30, 'Percentage %', 'higher_better', 2),
  ('Efficiency', 'Average Revision per Design', 10, 1, 'Revision', 'lower_better', 3),
  ('Quality', 'Technical Errors', 15, 1, 'Errors', 'lower_better', 4),
  ('Creative Development', 'New Exploration', 25, 4, 'Ideas', 'higher_better', 5)
) AS v(category, kpi_name, weight, target, unit, formula_type, sort_order)
WHERE d.slug = 'video-editor';

-- Sales
INSERT INTO kpi_templates (division_id, category, kpi_name, weight, target, unit, formula_type, sort_order)
SELECT d.id, v.category, v.kpi_name, v.weight, v.target, v.unit, v.formula_type, v.sort_order
FROM divisions d
CROSS JOIN (VALUES
  ('Productivity', 'Target Closing', 55, 30, 'Point', 'higher_better', 1),
  ('Productivity', 'Total Contact and Closing Ratio', 15, 0.03, 'Percentage %', 'higher_better', 2),
  ('Efficiency', 'Response Time Chat', 10, 10, 'Minute', 'lower_better', 3),
  ('Creative Development', 'New Exploration', 20, 3, 'Ideas', 'higher_better', 4)
) AS v(category, kpi_name, weight, target, unit, formula_type, sort_order)
WHERE d.slug = 'sales';

-- Community
INSERT INTO kpi_templates (division_id, category, kpi_name, weight, target, unit, formula_type, sort_order)
SELECT d.id, v.category, v.kpi_name, v.weight, v.target, v.unit, v.formula_type, v.sort_order
FROM divisions d
CROSS JOIN (VALUES
  ('Productivity', 'Member Activity', 25, 0.3, 'Percentage %', 'higher_better', 1),
  ('Productivity', 'Negative Rate', 25, 0.3, 'Percentage %', 'lower_better', 2),
  ('Productivity', 'Member Discussion Message Count', 15, 6000, 'Chat', 'higher_better', 3),
  ('Productivity', 'Shadow Project Account Message Count', 10, 4000, 'Chat', 'higher_better', 4),
  ('Productivity', 'Professor Shadow Project Discussion Message Count', 10, 50, 'Chat', 'higher_better', 5),
  ('Creative Development', 'New Exploration', 15, 4, 'Ideas', 'higher_better', 6)
) AS v(category, kpi_name, weight, target, unit, formula_type, sort_order)
WHERE d.slug = 'community';

-- Creative
INSERT INTO kpi_templates (division_id, category, kpi_name, weight, target, unit, formula_type, sort_order)
SELECT d.id, v.category, v.kpi_name, v.weight, v.target, v.unit, v.formula_type, v.sort_order
FROM divisions d
CROSS JOIN (VALUES
  ('Speed', 'On-Time News Post Rate (%)', 30, 90, 'Percentage %', 'higher_better', 1),
  ('Accuracy', 'Technical Mistakes (per month)', 7, 1, 'Errors', 'lower_better', 2),
  ('Accuracy', 'False Information Incidents', 8, 0, 'Incidents', 'lower_better', 3),
  ('Authority', 'Save Rate (%)', 5, 10, 'Percentage %', 'higher_better', 4),
  ('Authority', 'Share Rate (%)', 5, 5, 'Percentage %', 'higher_better', 5),
  ('Authority', 'Reel Skip Rate (%)', 5, 50, 'Percentage %', 'lower_better', 6),
  ('Authority', '3-Second Hold Rate (%)', 5, 40, 'Percentage %', 'higher_better', 7),
  ('Volume', 'Total Reels (per month)', 4, 90, 'Reels', 'higher_better', 8),
  ('Volume', 'Motion Videos (per month)', 3, 4, 'Videos', 'higher_better', 9),
  ('Volume', 'Feed Posts (per month)', 3, 60, 'Posts', 'higher_better', 10),
  ('Lead', 'Total Verified Leads', 10, 2400, 'Leads', 'higher_better', 11),
  ('Followers', 'Follower Growth Rate (%)', 15, 15, 'Percentage %', 'higher_better', 12)
) AS v(category, kpi_name, weight, target, unit, formula_type, sort_order)
WHERE d.slug = 'creative';

-- Research
INSERT INTO kpi_templates (division_id, category, kpi_name, weight, target, unit, formula_type, sort_order)
SELECT d.id, v.category, v.kpi_name, v.weight, v.target, v.unit, v.formula_type, v.sort_order
FROM divisions d
CROSS JOIN (VALUES
  ('Productivity', 'Weekly Macro Summary',      20, 12, 'Summary',    'higher_better', 1),
  ('Productivity', 'Crypto Monday Deep Dive',   15,  4, 'Report',     'higher_better', 2),
  ('Productivity', 'Daily Newsletter',          30, 20, 'Newsletter', 'higher_better', 3),
  ('Quality',      'Revision Rate',             20, 25, '%',          'lower_better',  4),
  ('Accuracy',     'Minor Typo Control',        15,  3, 'Typo',       'lower_better',  5)
) AS v(category, kpi_name, weight, target, unit, formula_type, sort_order)
WHERE d.slug = 'research';

-- Web Developer
INSERT INTO kpi_templates (division_id, category, kpi_name, weight, target, unit, formula_type, sort_order)
SELECT d.id, v.category, v.kpi_name, v.weight, v.target, v.unit, v.formula_type, v.sort_order
FROM divisions d
CROSS JOIN (VALUES
  ('Productivity', 'Task Delivery Speed',                  40, 90, '%',          'higher_better', 1),
  ('Quality',      'Release Quality Control (QC)',         30,  0, 'Bug',        'lower_better',  2),
  ('Security',     'Security & Backup',                    15,  4, 'Checklist',  'higher_better', 3),
  ('Quality',      'Documentation & Version Control',      15,  4, 'Checklist',  'higher_better', 4)
) AS v(category, kpi_name, weight, target, unit, formula_type, sort_order)
WHERE d.slug = 'web-developer';

-- Management
INSERT INTO kpi_templates (division_id, category, kpi_name, weight, target, unit, formula_type, sort_order)
SELECT d.id, v.category, v.kpi_name, v.weight, v.target, v.unit, v.formula_type, v.sort_order
FROM divisions d
CROSS JOIN (VALUES
  ('Recruitment',  'Time-to-Hire',                              15, 30, 'Day',        'lower_better',  1),
  ('Recruitment',  'Early Performance & Probation Control',     15,  0, 'Failed',     'lower_better',  2),
  ('Retention',    'High Performer Retention',                  20,  0, 'Exit',       'lower_better',  3),
  ('Compliance',   'Discipline & Compliance',                   15,  0, 'Error',      'lower_better',  4),
  ('Engagement',   'Monthly 1-on-1 Monitoring System',         15,100, '%',          'higher_better', 5),
  ('Retention',    'Retention Risk Monitoring',                 10,  1, 'Dashboard',  'higher_better', 6),
  ('Culture',      'Culture & Internal Activity Execution',     10,  1, 'Activity',   'higher_better', 7)
) AS v(category, kpi_name, weight, target, unit, formula_type, sort_order)
WHERE d.slug = 'management';

-- ============================================
-- SEED: ADMIN USER (password: admin123)
-- Hash generated with bcrypt
-- ============================================
INSERT INTO users (email, password_hash, full_name, role, division_id)
VALUES ('admin@kpi.com', '$2b$10$0IdlUFt4oLmV7KOQvVHp2.BvEDZaJlCEtiQr7heATBPSpYvjw2nXu', 'Administrator', 'admin', NULL);

-- ============================================
-- SEED: SAMPLE USERS
-- All passwords: user123
-- ============================================
INSERT INTO users (email, password_hash, full_name, role, division_id)
SELECT v.email, '$2b$10$VHfNCDBFUUqfni1wt8ed4.o/XJ/E5dXx5XdncqZ.csFHrUW7sVZTm', v.full_name, 'user', d.id
FROM divisions d
CROSS JOIN (VALUES
  ('rina@kpi.com', 'Rina Kartika'),
  ('budi@kpi.com', 'Budi Santoso'),
  ('dewi@kpi.com', 'Dewi Lestari')
) AS v(email, full_name)
WHERE d.slug = 'visual-creative'
UNION ALL
SELECT v.email, '$2b$10$VHfNCDBFUUqfni1wt8ed4.o/XJ/E5dXx5XdncqZ.csFHrUW7sVZTm', v.full_name, 'user', d.id
FROM divisions d
CROSS JOIN (VALUES
  ('andi@kpi.com', 'Andi Prasetyo'),
  ('sari@kpi.com', 'Sari Wulandari')
) AS v(email, full_name)
WHERE d.slug = 'video-editor'
UNION ALL
SELECT v.email, '$2b$10$VHfNCDBFUUqfni1wt8ed4.o/XJ/E5dXx5XdncqZ.csFHrUW7sVZTm', v.full_name, 'user', d.id
FROM divisions d
CROSS JOIN (VALUES
  ('fajar@kpi.com', 'Fajar Nugroho'),
  ('maya@kpi.com', 'Maya Putri'),
  ('rizki@kpi.com', 'Rizki Ramadhan')
) AS v(email, full_name)
WHERE d.slug = 'sales'
UNION ALL
SELECT v.email, '$2b$10$VHfNCDBFUUqfni1wt8ed4.o/XJ/E5dXx5XdncqZ.csFHrUW7sVZTm', v.full_name, 'user', d.id
FROM divisions d
CROSS JOIN (VALUES
  ('linda@kpi.com', 'Linda Susanti'),
  ('hendra@kpi.com', 'Hendra Wijaya')
) AS v(email, full_name)
WHERE d.slug = 'community';

-- ============================================
-- 6. ACTIVITY LOGS TABLE (Audit Trail)
-- ============================================
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type);

-- ============================================
-- RLS POLICIES (Row Level Security)
-- ============================================
ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_entries ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated operations via service role
CREATE POLICY "Allow all for service role" ON divisions FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON users FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON kpi_templates FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON kpi_entries FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON sessions FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON activity_logs FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON attendance_entries FOR ALL USING (true);
