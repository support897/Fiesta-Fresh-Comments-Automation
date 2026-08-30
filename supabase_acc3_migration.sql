-- ============================================
-- MIGRATION: allow BOTH ilse (main reply) AND
-- account 3 (URL drop) to record on the SAME post.
-- Run this in the Supabase SQL Editor (needs owner/service role).
-- ============================================

-- Drop the constraint that lets only ONE reply per (post, group).
ALTER TABLE public.replies_log DROP CONSTRAINT IF EXISTS replies_log_post_id_group_url_key;

-- Re-add it scoped per account, so each user_profile_id can have its own
-- row for the same post. NULL profiles still dedupe to one row.
CREATE UNIQUE INDEX IF NOT EXISTS replies_log_post_id_group_url_profile_key
    ON public.replies_log (post_id, COALESCE(group_url, ''), COALESCE(user_profile_id, ''));
