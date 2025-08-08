-- Change dictionaries.vector dimension to 1536 to match OpenAI text-embedding-3-small
-- and update dependent functions and indexes

-- Safety: drop index if exists before altering type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'idx_dictionaries_vector'
      AND n.nspname = 'public'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS public.idx_dictionaries_vector';
  END IF;
END $$;

-- Alter column type to VECTOR(1536)
ALTER TABLE public.dictionaries
  ALTER COLUMN vector TYPE VECTOR(1536);

-- Recreate ivfflat index for vector column
CREATE INDEX IF NOT EXISTS idx_dictionaries_vector
  ON public.dictionaries USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);

-- Update get_vector_similar_phrases function to accept VECTOR(1536)
CREATE OR REPLACE FUNCTION public.get_vector_similar_phrases(
    query_embedding VECTOR(1536),
    similarity_threshold FLOAT DEFAULT 0.75,
    org_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    phrase TEXT,
    category public.dictionary_category,
    similarity DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.phrase,
        d.category,
        (1 - (d.vector <=> query_embedding))::DOUBLE PRECISION as sim
    FROM public.dictionaries d
    WHERE d.vector IS NOT NULL
      AND (org_id IS NULL OR d.organization_id = org_id)
      AND (1 - (d.vector <=> query_embedding)) >= similarity_threshold
    ORDER BY d.vector <=> query_embedding
    LIMIT 100;
END;
$$ LANGUAGE plpgsql;


