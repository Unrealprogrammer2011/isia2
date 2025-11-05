// Quiz logic using Supabase database + realtime subscriptions
import { supabase } from './supabase.js';

export async function fetchQuestions() {
  // Returns the array of quiz questions from DB
  let { data, error } = await supabase
    .from('questions')
    .select('*')
    .order('id');
  if (error) throw error;
  return data;
}

export function subscribeQuestions(callback) {
  // Subscribes to questions table, receives new data in realtime
  return supabase
    .channel('public:questions')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, payload => {
      callback(payload);
    })
    .subscribe();
}

export async function saveScore(user_id, score) {
  // Upserts score for the current user
  const { error } = await supabase
    .from('scores')
    .upsert([{ user_id, score }], { onConflict: ['user_id'] });
  if (error) throw error;
}
export async function getScore(user_id) {
  const { data, error } = await supabase
    .from('scores')
    .select('score')
    .eq('user_id', user_id)
    .single();
  if (error || !data) return 0;
  return data.score;
}