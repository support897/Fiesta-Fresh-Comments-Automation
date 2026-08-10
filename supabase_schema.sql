-- ============================================
-- FIESTA FRESH CLEANING - DATABASE SCHEMA v2.0
-- Fixed: Added sessions table, proper indexes, composite keys
-- ============================================

-- 1. CONFIG TABLE
CREATE TABLE IF NOT EXISTS public.config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_status BOOLEAN DEFAULT false,
    reply_delay_min INT DEFAULT 60,
    reply_delay_max INT DEFAULT 180,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS public.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. GROUPS TABLE
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    schedule TEXT DEFAULT 'all',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. LEADS TABLE
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id TEXT NOT NULL UNIQUE,
    group_url TEXT NOT NULL,
    post_text TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Add index for faster status queries
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

-- 5. REPLIES LOG TABLE (FIXED: Composite unique constraint)
CREATE TABLE IF NOT EXISTS public.replies_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id TEXT,
    post_id TEXT NOT NULL,
    user_profile_id TEXT,
    group_url TEXT NOT NULL,
    replied_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(post_id, group_url)
);

-- Add indexes for fast deduplication checks
CREATE INDEX IF NOT EXISTS idx_replies_log_post_id ON public.replies_log(post_id);
CREATE INDEX IF NOT EXISTS idx_replies_log_group_url ON public.replies_log(group_url);

-- 6. AI MEMORY TABLE
CREATE TABLE IF NOT EXISTS public.ai_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. SESSIONS TABLE (ADDED - was missing in old schema)
CREATE TABLE IF NOT EXISTS public.sessions (
    user_email TEXT PRIMARY KEY,
    cookies JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ============================================
-- SEED INITIAL DATA
-- ============================================

-- Insert default config (bot paused initially for safety)
INSERT INTO public.config (id, bot_status, reply_delay_min, reply_delay_max) 
VALUES ('00000000-0000-0000-0000-000000000001', false, 60, 180)
ON CONFLICT (id) DO NOTHING;

-- Insert master template (200% Guarantee)
INSERT INTO public.templates (id, content, is_active) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Hi! 💙 We would absolutely love to help you out!

We are Fiesta Fresh Cleaning, a local Gold Coast team that genuinely cares about every single home and space we walk into. Fully insured, police-checked and proudly serving the Gold Coast community 🏡✨

And here is what makes us a little different from everyone else… we offer a 200% Happiness Guarantee on every single clean we do. That means if anything is not perfect we come back and fix it for FREE. No questions asked. We are the only cleaning company on the Gold Coast offering this and we stand behind it completely. 🙌

We are not a big franchise. We are your neighbours. A real local team that shows up, works hard and truly cares about leaving your space better than we found it. Every single time. 💙

You can check out everything we offer, read our reviews and even book in 60 seconds right here 👉 fiestafreshcleaning.com/book

We will also send you a DM just in case you have any questions. Make sure to check your message requests! We cannot wait to help you out. 🎉',
    true
) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, is_active = EXCLUDED.is_active;

-- Insert Facebook groups
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

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

SELECT 'Database schema created successfully! ✅' as status;
