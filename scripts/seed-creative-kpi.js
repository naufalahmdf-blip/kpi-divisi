/**
 * One-time script: Insert KPI templates for Creative division
 * Run: node scripts/seed-creative-kpi.js
 */
const { readFileSync } = require('fs');
const { resolve } = require('path');
const { createClient } = require('@supabase/supabase-js');

// Read .env.local
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim();
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Find Creative division
  const { data: div, error: divErr } = await supabase
    .from('divisions')
    .select('id, name')
    .eq('slug', 'creative')
    .single();

  if (divErr || !div) {
    // Try by name
    const { data: div2, error: divErr2 } = await supabase
      .from('divisions')
      .select('id, name')
      .ilike('name', '%creative%')
      .not('name', 'ilike', '%visual%');

    if (divErr2 || !div2 || div2.length === 0) {
      console.error('Creative division not found. Creating it...');
      const { data: newDiv, error: createErr } = await supabase
        .from('divisions')
        .insert({ name: 'Creative', slug: 'creative' })
        .select()
        .single();
      if (createErr) {
        console.error('Failed to create division:', createErr.message);
        process.exit(1);
      }
      console.log('Created Creative division:', newDiv.id);
      return await insertTemplates(newDiv.id);
    }

    const target = Array.isArray(div2) ? div2[0] : div2;
    console.log(`Found division: ${target.name} (${target.id})`);
    return await insertTemplates(target.id);
  }

  console.log(`Found division: ${div.name} (${div.id})`);
  await insertTemplates(div.id);
}

async function insertTemplates(divisionId) {
  // Delete existing templates for this division
  const { error: delErr } = await supabase
    .from('kpi_templates')
    .delete()
    .eq('division_id', divisionId);

  if (delErr) {
    console.error('Failed to delete old templates:', delErr.message);
    process.exit(1);
  }
  console.log('Cleared existing templates.');

  const templates = [
    { category: 'Speed',     kpi_name: 'On-Time News Post Rate (%)',   weight: 30, target: 90,  unit: 'Percentage %', formula_type: 'higher_better', sort_order: 1 },
    { category: 'Accuracy',  kpi_name: 'Technical Mistakes (per month)', weight: 7,  target: 1,   unit: 'Errors',       formula_type: 'lower_better',  sort_order: 2 },
    { category: 'Accuracy',  kpi_name: 'False Information Incidents',  weight: 8,  target: 0,   unit: 'Incidents',    formula_type: 'lower_better',  sort_order: 3 },
    { category: 'Authority', kpi_name: 'Save Rate (%)',                weight: 5,  target: 10,  unit: 'Percentage %', formula_type: 'higher_better', sort_order: 4 },
    { category: 'Authority', kpi_name: 'Share Rate (%)',               weight: 5,  target: 5,   unit: 'Percentage %', formula_type: 'higher_better', sort_order: 5 },
    { category: 'Authority', kpi_name: 'Reel Skip Rate (%)',           weight: 5,  target: 50,  unit: 'Percentage %', formula_type: 'lower_better',  sort_order: 6 },
    { category: 'Authority', kpi_name: '3-Second Hold Rate (%)',       weight: 5,  target: 40,  unit: 'Percentage %', formula_type: 'higher_better', sort_order: 7 },
    { category: 'Volume',    kpi_name: 'Total Reels (per month)',      weight: 4,  target: 90,  unit: 'Reels',        formula_type: 'higher_better', sort_order: 8 },
    { category: 'Volume',    kpi_name: 'Motion Videos (per month)',    weight: 3,  target: 4,   unit: 'Videos',       formula_type: 'higher_better', sort_order: 9 },
    { category: 'Volume',    kpi_name: 'Feed Posts (per month)',       weight: 3,  target: 60,  unit: 'Posts',        formula_type: 'higher_better', sort_order: 10 },
    { category: 'Lead',      kpi_name: 'Lead Conversion Rate (%)',     weight: 10, target: 0.3, unit: 'Percentage %', formula_type: 'higher_better', sort_order: 11 },
    { category: 'Followers', kpi_name: 'Follower Growth Rate (%)',     weight: 15, target: 15,  unit: 'Percentage %', formula_type: 'higher_better', sort_order: 12 },
  ];

  const rows = templates.map(t => ({ ...t, division_id: divisionId }));

  const { data, error } = await supabase
    .from('kpi_templates')
    .insert(rows)
    .select();

  if (error) {
    console.error('Failed to insert templates:', error.message);
    process.exit(1);
  }

  console.log(`\nInserted ${data.length} KPI templates for Creative division:`);
  console.log('─'.repeat(70));
  data.forEach(t => {
    console.log(`  [${t.category.padEnd(10)}] ${t.kpi_name.padEnd(35)} W:${String(t.weight).padStart(2)}%  T:${t.target}  (${t.formula_type})`);
  });
  console.log('─'.repeat(70));
  console.log(`Total weight: ${templates.reduce((s, t) => s + t.weight, 0)}%`);
}

main().catch(console.error);
