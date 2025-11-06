// quiz.js — resilient DB functions for questions, scores, leaderboard
import { supabase } from './supabase.js';

export async function fetchQuestions() {
  const { data, error, status } = await supabase
    .from('questions')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('[DB] fetchQuestions error', error, 'status', status);
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

// Try upserting with email first; on error retry without email column
export async function saveScore(user_id, score, email = null) {
  if (!user_id) throw new Error('Missing user_id');
  const payloadWithEmail = { user_id, score, email };

  try {
    // attempt to upsert including email (if column exists)
    const { data, error } = await supabase
      .from('scores')
      .upsert([payloadWithEmail], { onConflict: ['user_id'] });
    if (error) {
      // If the error explicitly mentions email column missing, fallthrough to retry
      if (typeof error.message === 'string' && error.message.toLowerCase().includes('column') && error.message.toLowerCase().includes('email')) {
        console.warn('saveScore: scores.email column missing, retrying without email');
        // fall through to retry below
      } else {
        throw error;
      }
    } else {
      return data;
    }
  } catch (err) {
    // If error mentions email column, try again without email
    if (err?.message && err.message.toLowerCase().includes('column') && err.message.toLowerCase().includes('email')) {
      // continue to retry without email
    } else {
      console.error('[DB] saveScore final error', err);
      throw err;
    }
  }

  // Retry without email column
  try {
    const { data, error } = await supabase
      .from('scores')
      .upsert([{ user_id, score }], { onConflict: ['user_id'] });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[DB] saveScore retry error', err);
    throw err;
  }
}

export async function getScore(user_id) {
  if (!user_id) return 0;
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('score')
      .eq('user_id', user_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[DB] getScore error', error);
      return 0;
    }
    return data?.score ?? 0;
  } catch (err) {
    console.error('[DB] getScore threw', err);
    return 0;
  }
}

// Try selecting email; if the column doesn't exist, fallback to selecting without it.
export async function getLeaderboard(limit = 10) {
  // First attempt: include email
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('user_id, score, email')
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      // If error mentions missing email column, fall through to retry
      if (typeof error.message === 'string' && error.message.toLowerCase().includes('column') && error.message.toLowerCase().includes('email')) {
        console.warn('getLeaderboard: scores.email column missing, retrying without email');
      } else {
        throw error;
      }
    } else {
      return data || [];
    }
  } catch (err) {
    if (!(err?.message && err.message.toLowerCase().includes('email'))) {
      console.error('[DB] getLeaderboard error', err);
      throw err;
    }
    // otherwise fall through to retry
  }

  // Retry without email
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('user_id, score')
      .order('score', { ascending: false })
      .limit(limit);

    if (error) throw error;
    // map to include a null email for consistent shape
    return (data || []).map(r => ({ ...r, email: null }));
  } catch (err) {
    console.error('[DB] getLeaderboard retry error', err);
    throw err;
  }
}
