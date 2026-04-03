import { createClient } from '@supabase/supabase-js';

// 1. Grab the variables from Vite's environment manager
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 2. Initialize the client
// This will now use whatever you typed in your .env.local file
export const supabase = createClient(supabaseUrl, supabaseAnonKey);