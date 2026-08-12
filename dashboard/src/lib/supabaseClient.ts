import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xbqkcjobdnrbetrgjjrd.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_UWbZXjdMsf_Ikp2LtPRWyA_85Wop9Xg';

export const isConfigured = true;

export const supabase = createClient(supabaseUrl, supabaseKey);
