import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? 'Fall 2025';
  const demoType = searchParams.get('demo') ?? 'gender';

  const db = getSupabase();

  // Get survey scores for the selected period and demographic type
  const { data: scores, error } = await db
    .from('deib_surveys')
    .select('*')
    .eq('survey_period', period)
    .eq('demographic_type', demoType)
    .order('factor')
    .order('question');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get overall scores (demographic_value = 'Overall') for comparison
  const { data: overallScores } = await db
    .from('deib_surveys')
    .select('factor, question, score')
    .eq('survey_period', period)
    .eq('demographic_type', demoType)
    .eq('demographic_value', 'Overall');

  // Get DEI-specific scores from Oct 2024 for YoY comparison
  const { data: priorScores } = await db
    .from('deib_surveys')
    .select('factor, question, score, demographic_value')
    .eq('survey_period', 'Oct 2024')
    .eq('demographic_type', demoType);

  // Get comments
  const { data: comments } = await db
    .from('deib_comments')
    .select('*')
    .order('created_at', { ascending: false });

  // Get unique demographic values and their N counts
  const demoValues = new Map<string, number>();
  for (const s of scores ?? []) {
    if (s.demographic_value !== 'Overall' && !demoValues.has(s.demographic_value)) {
      demoValues.set(s.demographic_value, s.respondent_count ?? 0);
    }
  }

  // Get unique factors
  const factors = [...new Set((scores ?? []).filter(s => !s.question).map(s => s.factor))];

  return NextResponse.json({
    scores: scores ?? [],
    overallScores: overallScores ?? [],
    priorScores: priorScores ?? [],
    comments: comments ?? [],
    demographics: Object.fromEntries(demoValues),
    factors,
    period,
    demoType,
  });
}
