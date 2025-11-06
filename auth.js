// auth.js — auth helpers and profile upsert/update/get
import { supabase } from './supabase.js';

// Sign up with optional username (will be stored in user_metadata if provided)
export async function signup(email, password, username = null) {
  try {
    // pass username in user metadata if provided
    const options = username ? { data: { username } } : undefined;
    const res = await supabase.auth.signUp({ email, password }, options);
    return res; // contains data and error (user may need confirmation)
  } catch (err) {
    return { error: err };
  }
}

export async function login(email, password) {
  try {
    const res = await supabase.auth.signInWithPassword({ email, password });
    return res;
  } catch (err) {
    return { error: err };
  }
}

export async function logout() {
  await supabase.auth.signOut();
}

export function onAuthStateChange(callback) {
  // Keep compatibility: call callback(session)
  supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}

export async function getUser() {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user ?? null;
  } catch (err) {
    console.warn('getUser failed', err);
    return null;
  }
}

// Upsert a profile row for the user (profiles.id = auth.users.id)
export async function upsertProfile(user_id, username) {
  if (!user_id || !username) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert([{ id: user_id, username }], { onConflict: ['id'] });
    if (error) {
      console.warn('upsertProfile error', error);
      return { error };
    }
    return { data };
  } catch (err) {
    console.error('upsertProfile failed', err);
    return { error: err };
  }
}

// Fetch profile by user id
export async function getProfile(user_id) {
  if (!user_id) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user_id)
      .single();
    if (error) {
      // PGRST116 returned when not found; return null
      if (error?.code === 'PGRST116') return null;
      console.warn('getProfile error', error);
      return null;
    }
    return data?.username ?? null;
  } catch (err) {
    console.error('getProfile threw', err);
    return null;
  }
}
// v7
