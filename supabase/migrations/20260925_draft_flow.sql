-- ============================================
-- MIGRATION 2026-09-25: human-in-the-loop draft flow
-- Run this ONCE in the Supabase SQL Editor (needs owner/service role).
-- The bot/dashboard use the anon key and cannot run DDL.
-- ============================================

-- ── 1. Service types (dashboard-toggleable) ──────────────
CREATE TABLE IF NOT EXISTS public.service_types (
    key TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.service_types (key, label, is_active, sort_order) VALUES
    ('bond',       'Bond Cleaning',                      true,  1),
    ('carpet',     'Carpet Cleaning',                    true,  2),
    ('builders',   'Post-Construction / Builders Clean', true,  3),
    ('commercial', 'Commercial Cleaning',                true,  4),
    ('home',       'Home Cleaning',                      false, 5)
ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order;
-- NOTE: is_active is intentionally NOT overwritten, so dashboard toggles survive re-runs.

-- ── 2. Comment queue (draft → Acc2 posted → Acc3 posted) ─
CREATE TABLE IF NOT EXISTS public.comment_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id TEXT NOT NULL,
    account TEXT NOT NULL CHECK (account IN ('acc2', 'acc3')),
    group_url TEXT NOT NULL,
    post_text TEXT NOT NULL,
    service_type TEXT NOT NULL REFERENCES public.service_types(key),
    comment_text TEXT NOT NULL,
    permalink TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft_ready' CHECK (status IN ('draft_ready', 'posted', 'skipped')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    posted_at TIMESTAMPTZ,
    UNIQUE (post_id, account)
);

CREATE INDEX IF NOT EXISTS idx_cq_status      ON public.comment_queue (status);
CREATE INDEX IF NOT EXISTS idx_cq_account     ON public.comment_queue (account);
CREATE INDEX IF NOT EXISTS idx_cq_created     ON public.comment_queue (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cq_post        ON public.comment_queue (post_id);

-- ── 3. Templates: per clean type ─────────────────────────
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'general';

-- Bond template (no names — "Hi mate" per house rules)
INSERT INTO public.templates (content, service_type, is_active) VALUES (
'Hi mate! 💙 We would absolutely love to help you with your bond clean!

At Fiesta Fresh Cleaning we are a local Gold Coast team that genuinely cares about every single clean we do. We are fully insured, police - checked and we work with multiple real estate agents so we understand what needs to be done. 🏡✨

And here is what makes us a little different from everyone else… we offer a 200% Happiness Guarantee on all of our bond cleans. That means if anything is not perfect we come back and fix it for FREE. Still not happy? You get your money back. No questions asked. We are the only cleaning company on the Gold Coast offering this and we stand behind it completely. 🙌

We also do carpet cleaning and pest control so you can get everything sorted in one go without the stress of chasing multiple people around. 💙

You can check out everything we offer, read our reviews and even book in 60 seconds right here 👉 fiestafreshcleaning.com/book

We will also send you a DM just in case you have any questions. Make sure to check your message requests! We cannot wait to help you get that bond back! 🎉',
    'bond', true
) ON CONFLICT DO NOTHING;

-- General template (used for carpet / builders / commercial)
INSERT INTO public.templates (content, service_type, is_active) VALUES (
'Hi mate! 💙 We would absolutely love to help you out!

We are Fiesta Fresh Cleaning, a local Gold Coast team that genuinely cares about every single home and space we walk into. Fully insured, police-checked and proudly serving the Gold Coast community 🏡✨

And here is what makes us a little different from everyone else… we offer a 200% Happiness Guarantee on every single clean we do. That means if anything is not perfect we come back and fix it for FREE. No questions asked. We are the only cleaning company on the Gold Coast offering this and we stand behind it completely. 🙌

We are not a big franchise. We are your neighbours. A real local team that shows up, works hard and truly cares about leaving your space better than we found it. Every single time. 💙

You can check out everything we offer, read our reviews and even book in 60 seconds right here 👉 fiestafreshcleaning.com/book

We will also send you a DM just in case you have any questions. Make sure to check your message requests! We cannot wait to help you out. 🎉',
    'general', true
) ON CONFLICT DO NOTHING;

-- ── 4. RLS: same permissive pattern as the existing tables ─
-- (anon key is used by both the patrol runner and the dashboard)
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_types_select" ON public.service_types;
DROP POLICY IF EXISTS "service_types_update" ON public.service_types;
CREATE POLICY "service_types_select" ON public.service_types FOR SELECT USING (true);
CREATE POLICY "service_types_update" ON public.service_types FOR UPDATE USING (true);

DROP POLICY IF EXISTS "cq_select" ON public.comment_queue;
DROP POLICY IF EXISTS "cq_insert" ON public.comment_queue;
DROP POLICY IF EXISTS "cq_update" ON public.comment_queue;
CREATE POLICY "cq_select" ON public.comment_queue FOR SELECT USING (true);
CREATE POLICY "cq_insert" ON public.comment_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "cq_update" ON public.comment_queue FOR UPDATE USING (true);

SELECT 'Draft-flow migration applied ✅' AS status;
