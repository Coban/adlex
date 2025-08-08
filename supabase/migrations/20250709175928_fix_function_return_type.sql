-- Function to get similar phrases using pg_trgm
CREATE OR REPLACE FUNCTION get_similar_phrases(
    input_text TEXT,
    similarity_threshold FLOAT DEFAULT 0.3,
    org_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    phrase TEXT,
    category dictionary_category,
    similarity DOUBLE PRECISION -- Changed from FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.phrase,
        d.category,
        similarity(d.phrase, input_text)::DOUBLE PRECISION as sim -- Cast to DOUBLE PRECISION
    FROM dictionaries d
    WHERE (org_id IS NULL OR d.organization_id = org_id)
        AND similarity(d.phrase, input_text) >= similarity_threshold
    ORDER BY sim DESC
    LIMIT 1000;
END;
$$ LANGUAGE plpgsql;

-- Function to get vector similar phrases
CREATE OR REPLACE FUNCTION get_vector_similar_phrases(
    query_embedding VECTOR(384),
    similarity_threshold FLOAT DEFAULT 0.75,
    org_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    phrase TEXT,
    category dictionary_category,
    similarity DOUBLE PRECISION -- Changed from FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.phrase,
        d.category,
        (1 - (d.vector <=> query_embedding))::DOUBLE PRECISION as sim -- Cast to DOUBLE PRECISION
    FROM dictionaries d
    WHERE d.vector IS NOT NULL
        AND (org_id IS NULL OR d.organization_id = org_id)
        AND (1 - (d.vector <=> query_embedding)) >= similarity_threshold
    ORDER BY d.vector <=> query_embedding
    LIMIT 100;
END;
$$ LANGUAGE plpgsql;
