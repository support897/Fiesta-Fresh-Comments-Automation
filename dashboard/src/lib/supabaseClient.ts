import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Fallback to placeholder values to prevent module initialization crashes
const safeUrl = supabaseUrl && supabaseUrl.startsWith('http') ? supabaseUrl : 'https://placeholder.supabase.co';
const safeKey = supabaseKey || 'placeholder-key';

export const supabase = createClient(safeUrl, safeKey);

