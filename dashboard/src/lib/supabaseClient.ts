import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isConfigured = !!(supabaseUrl && supabaseUrl.startsWith('http') && supabaseKey);

// Fallback to placeholder values to prevent module initialization crashes
const safeUrl = isConfigured ? supabaseUrl : 'https://placeholder.supabase.co';
const safeKey = isConfigured ? supabaseKey : 'placeholder-key';

export const supabase = createClient(safeUrl, safeKey);
