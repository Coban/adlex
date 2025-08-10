-- Fix return type consistency for get_combined_similar_phrases
-- Ensure all computed numeric values are DOUBLE PRECISION and parameter dimension matches dictionaries.vector

CREATE OR REPLACE FUNCTION public.get_combined_similar_phrases(
    input_text TEXT,
    org_id BIGINT,
    trgm_threshold DOUBLE PRECISION DEFAULT 0.3,
    vector_threshold DOUBLE PRECISION DEFAULT 0.75,
    query_embedding VECTOR(1536) DEFAULT NULL,
    max_results INTEGER DEFAULT 100
)
RETURNS TABLE (
    id BIGINT,
    phrase TEXT,
    category public.dictionary_category,
    trgm_similarity DOUBLE PRECISION,
    vector_similarity DOUBLE PRECISION,
    combined_score DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    WITH trgm_results AS (
        SELECT 
            d.id,
            d.phrase,
            d.category,
            similarity(d.phrase, input_text)::DOUBLE PRECISION AS trgm_sim,
            0.0::DOUBLE PRECISION AS vector_sim
        FROM public.dictionaries d
        WHERE d.organization_id = org_id
          AND similarity(d.phrase, input_text) >= trgm_threshold
    ),
    vector_results AS (
        SELECT 
            d.id,
            d.phrase,
            d.category,
            0.0::DOUBLE PRECISION AS trgm_sim,
            CASE 
                WHEN query_embedding IS NOT NULL AND d.vector IS NOT NULL
                    THEN (1 - (d.vector <=> query_embedding))::DOUBLE PRECISION
                ELSE 0.0::DOUBLE PRECISION
            END AS vector_sim
        FROM public.dictionaries d
        WHERE d.organization_id = org_id
          AND query_embedding IS NOT NULL
          AND d.vector IS NOT NULL
          AND (1 - (d.vector <=> query_embedding)) >= vector_threshold
    ),
    combined_results AS (
        SELECT 
            COALESCE(t.id, v.id) AS id,
            COALESCE(t.phrase, v.phrase) AS phrase,
            COALESCE(t.category, v.category) AS category,
            GREATEST(COALESCE(t.trgm_sim, 0.0::DOUBLE PRECISION), COALESCE(v.trgm_sim, 0.0::DOUBLE PRECISION)) AS trgm_similarity,
            GREATEST(COALESCE(t.vector_sim, 0.0::DOUBLE PRECISION), COALESCE(v.vector_sim, 0.0::DOUBLE PRECISION)) AS vector_similarity
        FROM trgm_results t
        FULL OUTER JOIN vector_results v ON t.id = v.id
    )
    SELECT 
        cr.id,
        cr.phrase,
        cr.category,
        cr.trgm_similarity,
        cr.vector_similarity,
        (cr.trgm_similarity * 0.3 + cr.vector_similarity * 0.7)::DOUBLE PRECISION AS combined_score
    FROM combined_results cr
    ORDER BY combined_score DESC, cr.vector_similarity DESC, cr.trgm_similarity DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_combined_similar_phrases IS '統合された類似フレーズ検索（trgm+vector） - 型をDOUBLE PRECISIONに統一';


