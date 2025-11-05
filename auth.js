// Handles user login/signup/logout flow with Supabase
import { supabase } from './supabase.js';

export async function signup(email, password) {
  return await supabase.auth.signUp({ email, password });
}

export async function login(email, password) {
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function logout() {
  await supabase.auth.signOut();
}

export function onAuthStateChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user;
}