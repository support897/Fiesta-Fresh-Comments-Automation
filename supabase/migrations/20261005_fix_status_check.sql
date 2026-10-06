-- 2026-10-05: allow the broken_link / already_commented statuses.
-- Migration 20261004_broken_link_tracking assumed status was unconstrained TEXT,
-- but 20260925_draft_flow created CHECK (status IN ('draft_ready','posted','skipped')).
-- Apply via Supabase SQL editor / Management API (needs DDL privileges).
ALTER TABLE comment_queue DROP CONSTRAINT IF EXISTS comment_queue_status_check;
ALTER TABLE comment_queue ADD CONSTRAINT comment_queue_status_check
  CHECK (status IN ('draft_ready', 'posted', 'skipped', 'broken_link', 'already_commented'));
