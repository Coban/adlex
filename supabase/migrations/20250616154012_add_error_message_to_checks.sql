-- Add error_message column to checks table
ALTER TABLE checks ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add index for faster queries on failed checks
CREATE INDEX IF NOT EXISTS idx_checks_status_error ON checks(status) WHERE status = 'failed';
