-- Add image/OCR related fields to checks table

-- Create enums if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'check_input_type') THEN
        CREATE TYPE check_input_type AS ENUM ('text', 'image');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ocr_status') THEN
        CREATE TYPE ocr_status AS ENUM ('pending', 'processing', 'completed', 'failed');
    END IF;
END $$;

-- Add columns if not exists
ALTER TABLE checks
    ADD COLUMN IF NOT EXISTS input_type check_input_type DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS extracted_text TEXT,
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS ocr_status ocr_status,
    ADD COLUMN IF NOT EXISTS ocr_metadata JSONB;

-- Helpful index for filtering by input_type/ocr_status
CREATE INDEX IF NOT EXISTS idx_checks_input_type ON checks(input_type);
CREATE INDEX IF NOT EXISTS idx_checks_ocr_status ON checks(ocr_status);


