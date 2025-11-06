// quiz.js — DB functions: questions, scores, leaderboard (joins profiles)
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

export async function saveScore(user_id, score) {
  if (!user_id) throw new Error('Missing user_id');
  const payload = { user_id, score };
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

  if (error && error.code !== 'PGRST116') {
    console.warn('getScore error', error);
    return 0;
  }
  return data?.score ?? 0;
}

// Leaderboard: join scores -> profiles(username)
export async function getLeaderboard(limit = 10) {
  // select profiles(username) via relationship; results include profiles array
  const { data, error } = await supabase
    .from('scores')
    .select('user_id, score, profiles!inner(username)')
    .order('score', { ascending: false })
    .limit(limit);

  if (error) {
    // fallback: select without join
    console.warn('getLeaderboard join error, retrying without profiles', error);
    const { data: fallback, error: err2 } = await supabase
      .from('scores')
      .select('user_id, score')
      .order('score', { ascending: false })
      .limit(limit);
    if (err2) throw err2;
    return (fallback || []).map(r => ({ user_id: r.user_id, score: r.score, username: null }));
  }

  // Map rows: profiles is returned as array because of relationship; pick first username
  return (data || []).map(r => ({
    user_id: r.user_id,
    score: r.score,
    username: Array.isArray(r.profiles) && r.profiles[0] ? r.profiles[0].username : null
  }));
}
