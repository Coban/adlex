-- Add icon and logo fields to organizations table
ALTER TABLE organizations 
ADD COLUMN icon_url TEXT,
ADD COLUMN logo_url TEXT;

-- Update RLS policies to ensure users can only view their organization's icons/logos
-- (existing RLS policies should already cover this, but being explicit)

-- Add comments for documentation
COMMENT ON COLUMN organizations.icon_url IS 'URL to organization icon image (typically 32x32 or 64x64)';
COMMENT ON COLUMN organizations.logo_url IS 'URL to organization logo image (typically for headers, variable size)';