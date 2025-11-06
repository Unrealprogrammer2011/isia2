// quiz.js — Supabase DB functions for questions, scores, leaderboard
import { supabase } from './supabase.js';

export async function fetchQuestions() {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('fetchQuestions error', error);
    throw error;
  }
  return data || [];
}

export function subscribeQuestions(callback) {
  return supabase
    .channel('public:questions')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, payload => {
      callback(payload);
    })
    .subscribe();
}

// Upsert score with user email (email column must exist in scores table)
export async function saveScore(user_id, score, email = null) {
  if (!user_id) throw new Error('Missing user_id');
  const payload = { user_id, score, email };
  const { data, error } = await supabase
    .from('scores')
    .upsert([payload], { onConflict: ['user_id'] });
  if (error) {
    console.error('saveScore error', error);
    throw error;
  }
  return data;
}

export async function getScore(user_id) {
  if (!user_id) return 0;
  const { data, error } = await supabase
    .from('scores')
    .select('score')
    .eq('user_id', user_id)
    .single();

  if (error && error.code !== 'PGRST116') { // single returns PGRST116 if not found
    console.error('getScore error', error);
    return 0;
  }
  return data?.score ?? 0;
}

// Leaderboard: top N scores (returns array of {user_id, email, score})
export async function getLeaderboard(limit = 10) {
  const { data, error } = await supabase
    .from('scores')
    .select('user_id, score, email')
    .order('score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('getLeaderboard error', error);
    throw error;
  }
  return data || [];
}
