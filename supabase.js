// Supabase client - configured for your project
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const SUPABASE_URL = "https://pbyfdgzfuwhohliippbz.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBieWZkZ3pmdXdob2hsaWlwcGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNzQ1OTcsImV4cCI6MjA3Nzk1MDU5N30.TErujV6njj44Ui7kMGtJ3FzzyQECIihfzjFptWdHH2I";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
