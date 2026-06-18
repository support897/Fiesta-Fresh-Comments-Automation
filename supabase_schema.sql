-- Supabase Schema for Facebook Comments Bot

-- 1. Configuration Table
CREATE TABLE public.config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_status BOOLEAN DEFAULT false,
    reply_delay_min INT DEFAULT 60,
    reply_delay_max INT DEFAULT 180,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert default config row
INSERT INTO public.config (bot_status, reply_delay_min, reply_delay_max) VALUES (false, 60, 180);

-- 2. Templates Table
CREATE TABLE public.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert the first draft template
INSERT INTO public.templates (content, is_active) 
VALUES (
    'Hi there! We would absolutely love to help you out with this 💙 Our team specializes in exactly what you need and we pride ourselves on being super reliable and thorough. Feel free to send us a direct message here or check out our website to get a quick quote! ✨
#FiestaFresh #GoldCoastCleaning #ReliableCleaners #HouseCleaning #BondClean', 
    true
);

-- 3. Keywords Table
CREATE TABLE public.keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phrase TEXT NOT NULL,
    category TEXT
);

-- 4. Groups Table
CREATE TABLE public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- 5. Replies Log
CREATE TABLE public.replies_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id TEXT NOT NULL,
    post_id TEXT NOT NULL,
    user_profile_id TEXT,
    group_url TEXT,
    replied_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Ensure we can easily query to prevent duplicates:
CREATE INDEX idx_replies_log_comment_id ON public.replies_log(comment_id);
CREATE INDEX idx_replies_log_post_user ON public.replies_log(post_id, user_profile_id);

-- 6. Leads Table (Scraped Posts for Human Review)
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id TEXT NOT NULL UNIQUE,
    group_url TEXT NOT NULL,
    post_text TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected, posted
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. AI Memory Table (Stores extracted rules from rejections)
CREATE TABLE public.ai_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
