-- Add broken link and already-commented tracking to comment_queue
-- Run this in Supabase SQL Editor

-- Add failure_reason column to track why a post couldn't be commented on
ALTER TABLE comment_queue
ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Add comment_url to store the direct link to our posted comment
ALTER TABLE comment_queue
ADD COLUMN IF NOT EXISTS comment_url TEXT;

-- Create index for faster broken link queries
CREATE INDEX IF NOT EXISTS idx_comment_queue_status
ON comment_queue(status);

-- Add 'broken_link' and 'already_commented' as valid statuses
-- (status is TEXT, so no constraint change needed, just documenting)
COMMENT ON COLUMN comment_queue.failure_reason IS
'Why posting failed: broken_link, already_commented, post_removed, etc.';
COMMENT ON COLUMN comment_queue.comment_url IS
'Direct URL to our posted comment on Facebook';
