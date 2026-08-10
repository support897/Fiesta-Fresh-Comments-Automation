-- ============================================
-- FIX: Enable Row Level Security policies (v2.1)
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable RLS on all tables (in case not already)
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replies_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CONFIG: dashboard must read + toggle bot on/off
-- ============================================
DROP POLICY IF EXISTS "config_select" ON public.config;
DROP POLICY IF EXISTS "config_update" ON public.config;
CREATE POLICY "config_select" ON public.config FOR SELECT USING (true);
CREATE POLICY "config_update" ON public.config FOR UPDATE USING (true);

-- ============================================
-- TEMPLATES: dashboard reads/updates; bot reads
-- ============================================
DROP POLICY IF EXISTS "templates_select" ON public.templates;
DROP POLICY IF EXISTS "templates_update" ON public.templates;
DROP POLICY IF EXISTS "templates_insert" ON public.templates;
CREATE POLICY "templates_select" ON public.templates FOR SELECT USING (true);
CREATE POLICY "templates_update" ON public.templates FOR UPDATE USING (true);
CREATE POLICY "templates_insert" ON public.templates FOR INSERT WITH CHECK (true);

-- ============================================
-- GROUPS: bot reads; dashboard manages
-- ============================================
DROP POLICY IF EXISTS "groups_select" ON public.groups;
DROP POLICY IF EXISTS "groups_insert" ON public.groups;
DROP POLICY IF EXISTS "groups_delete" ON public.groups;
CREATE POLICY "groups_select" ON public.groups FOR SELECT USING (true);
CREATE POLICY "groups_insert" ON public.groups FOR INSERT WITH CHECK (true);
CREATE POLICY "groups_delete" ON public.groups FOR DELETE USING (true);

-- ============================================
-- LEADS: bot writes; dashboard reads
-- ============================================
DROP POLICY IF EXISTS "leads_select" ON public.leads;
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_select" ON public.leads FOR SELECT USING (true);
CREATE POLICY "leads_insert" ON public.leads FOR INSERT WITH CHECK (true);

-- ============================================
-- REPLIES_LOG: bot writes; dashboard reads
-- ============================================
DROP POLICY IF EXISTS "replies_select" ON public.replies_log;
DROP POLICY IF EXISTS "replies_insert" ON public.replies_log;
CREATE POLICY "replies_select" ON public.replies_log FOR SELECT USING (true);
CREATE POLICY "replies_insert" ON public.replies_log FOR INSERT WITH CHECK (true);

-- ============================================
-- AI_MEMORY: bot writes
-- ============================================
DROP POLICY IF EXISTS "ai_memory_select" ON public.ai_memory;
DROP POLICY IF EXISTS "ai_memory_insert" ON public.ai_memory;
CREATE POLICY "ai_memory_select" ON public.ai_memory FOR SELECT USING (true);
CREATE POLICY "ai_memory_insert" ON public.ai_memory FOR INSERT WITH CHECK (true);

-- ============================================
-- SESSIONS: bot reads/writes
-- ============================================
DROP POLICY IF EXISTS "sessions_select" ON public.sessions;
DROP POLICY IF EXISTS "sessions_insert" ON public.sessions;
DROP POLICY IF EXISTS "sessions_update" ON public.sessions;
CREATE POLICY "sessions_select" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "sessions_insert" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "sessions_update" ON public.sessions FOR UPDATE USING (true);

-- ============================================
-- THEN RE-SEED DATA (now that policies allow writes)
-- ============================================

INSERT INTO public.config (id, bot_status, reply_delay_min, reply_delay_max) 
VALUES ('00000000-0000-0000-0000-000000000001', false, 60, 180)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.templates (id, content, is_active) VALUES (
    '00000000-0000-0000-0000-000000000001',
    E'Hi! 💙 We would absolutely love to help you out!\n\nWe are Fiesta Fresh Cleaning, a local Gold Coast team that genuinely cares about every single home and space we walk into. Fully insured, police-checked and proudly serving the Gold Coast community 🏡✨\n\nAnd here is what makes us a little different from everyone else… we offer a 200% Happiness Guarantee on every single clean we do. That means if anything is not perfect we come back and fix it for FREE. No questions asked. We are the only cleaning company on the Gold Coast offering this and we stand behind it completely. 🙌\n\nWe are not a big franchise. We are your neighbours. A real local team that shows up, works hard and truly cares about leaving your space better than we found it. Every single time. 💙\n\nYou can check out everything we offer, read our reviews and even book in 60 seconds right here 👉 fiestafreshcleaning.com/book\n\nWe will also send you a DM just in case you have any questions. Make sure to check your message requests! We cannot wait to help you out. 🎉',
    true
) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, is_active = EXCLUDED.is_active;

INSERT INTO public.groups (url, is_active, schedule) VALUES
    ('https://www.facebook.com/share/g/17ZhFPW6Nv/?mibextid=wwXIfr', true, 'all'),
    ('https://www.facebook.com/share/g/1B27Gxp16H/?mibextid=wwXIfr', true, 'all'),
    ('https://www.facebook.com/share/g/1QKymNFKGB/?mibextid=wwXIfr', true, 'all'),
    ('https://www.facebook.com/share/g/18LVQKPo7i/?mibextid=wwXIfr', true, 'all'),
    ('https://www.facebook.com/share/g/1HtBL7VbvU/?mibextid=wwXIfr', true, 'all'),
    ('https://www.facebook.com/share/g/1ACxjEMmPz/?mibextid=wwXIfr', true, 'all'),
    ('https://www.facebook.com/share/g/1AvLccktib/?mibextid=wwXIfr', true, 'all'),
    ('https://www.facebook.com/share/g/1Ce8GyrQa7/?mibextid=wwXIfr', true, 'all'),
    ('https://www.facebook.com/share/g/1amVvrFuJW/?mibextid=wwXIfr', true, 'all'),
    ('https://www.facebook.com/share/g/1FfBrj1rcj/?mibextid=wwXIfr', true, 'all'),
    ('https://www.facebook.com/share/g/17TXZukru4/?mibextid=wwXIfr', true, 'all'),
    ('https://www.facebook.com/share/g/1CujCYNcjN/?mibextid=wwXIfr', true, 'all'),
    ('https://www.facebook.com/share/g/1H5MZ8PjQx/?mibextid=wwXIfr', true, 'all'),
    ('https://www.facebook.com/share/g/1S1927sm62/?mibextid=wwXIfr', true, 'all'),
    ('https://www.facebook.com/share/g/18aQe7qUsN/?mibextid=wwXIfr', true, 'all'),
    ('https://www.facebook.com/share/g/1C3WT4B5DL/?mibextid=wwXIfr', true, 'all'),
    ('https://www.facebook.com/share/g/1b6cBgTmom/?mibextid=wwXIfr', true, 'all'),
    ('https://www.facebook.com/share/g/1CbgwuTsYk/?mibextid=wwXIfr', true, 'Monday'),
    ('https://www.facebook.com/share/g/1JiqcFo29z/?mibextid=wwXIfr', true, 'Thursday')
ON CONFLICT (url) DO NOTHING;

SELECT 'RLS policies + seed data applied! ✅' as status;
