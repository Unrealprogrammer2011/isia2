// debug auth.js — verbose logging and returns full responses
import { supabase } from './supabase.js';

export async function signup(email, password, username = null) {
  console.log('[auth] signup', email, { usernameProvided: !!username });
  try {
    const options = username ? { data: { username } } : undefined;
    const res = await supabase.auth.signUp({ email, password }, options);
    console.log('[auth] signup res', res);
    return res;
  } catch (err) {
    console.error('[auth] signup error', err);
    return { error: err };
  }
}

export async function login(email, password) {
  console.log('[auth] login', email);
  try {
    const res = await supabase.auth.signInWithPassword({ email, password });
    console.log('[auth] login res', res);
    return res;
  } catch (err) {
    console.error('[auth] login error', err);
    return { error: err };
  }
}

export async function logout() {
  console.log('[auth] logout');
  try {
    const res = await supabase.auth.signOut();
    console.log('[auth] signOut res', res);
  } catch (err) {
    console.error('[auth] signOut error', err);
  }
}

export function onAuthStateChange(callback) {
  // Supabase gives (_event, session) — normalize to pass session only
  supabase.auth.onAuthStateChange((_event, session) => {
    console.log('[auth] onAuthStateChange', _event, session);
    callback(session);
  });
}

export async function getUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    console.log('[auth] getUser', data, error);
    return data?.user ?? null;
  } catch (err) {
    console.warn('[auth] getUser failed', err);
    return null;
  }
}

// profile helpers (used elsewhere)
export async function upsertProfile(user_id, username) {
  if (!user_id || !username) return { error: 'missing' };
  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert([{ id: user_id, username }], { onConflict: ['id'] });
    console.log('[auth] upsertProfile', data, error);
    return { data, error };
  } catch (err) {
    console.error('[auth] upsertProfile error', err);
    return { error: err };
  }
}

export async function getProfile(user_id) {
  if (!user_id) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user_id)
      .single();
    console.log('[auth] getProfile', data, error);
    if (error) {
      if (error.code === 'PGRST116') return null;
      console.warn('[auth] getProfile error', error);
      return null;
    }
    return data?.username ?? null;
  } catch (err) {
    console.error('[auth] getProfile threw', err);
    return null;
  }
}
