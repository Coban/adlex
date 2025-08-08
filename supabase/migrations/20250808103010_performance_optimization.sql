-- AdLex Performance Optimization - Database Indexes and Queries (Migration)
-- This migration applies additional indexes and optimized functions to improve performance

-- =============================================================================
-- 1. 複合インデックスの追加（検索・ソートパフォーマンス向上）
-- =============================================================================

-- チェック履歴の高速検索用（organization_id + status + created_at）
CREATE INDEX IF NOT EXISTS idx_checks_org_status_created 
ON checks(organization_id, status, created_at DESC)
WHERE deleted_at IS NULL;

-- ユーザー別チェック履歴用（user_id + created_at）
CREATE INDEX IF NOT EXISTS idx_checks_user_created 
ON checks(user_id, created_at DESC)
WHERE deleted_at IS NULL;

-- ステータス別処理用（status + created_at）
CREATE INDEX IF NOT EXISTS idx_checks_status_created 
ON checks(status, created_at ASC)
WHERE status IN ('pending', 'processing');

-- 組織別辞書検索用（organization_id + category）
CREATE INDEX IF NOT EXISTS idx_dictionaries_org_category 
ON dictionaries(organization_id, category);

-- =============================================================================
-- 2. フルテキスト検索インデックス（日本語対応）
-- =============================================================================

-- 日本語フルテキスト検索用GINインデックス
CREATE INDEX IF NOT EXISTS idx_checks_original_text_gin 
ON checks USING GIN (to_tsvector('simple', original_text))
WHERE deleted_at IS NULL;

-- 修正テキストの検索用
CREATE INDEX IF NOT EXISTS idx_checks_modified_text_gin 
ON checks USING GIN (to_tsvector('simple', modified_text))
WHERE modified_text IS NOT NULL AND deleted_at IS NULL;

-- 辞書フレーズの日本語検索用（既存のtrgmと併用）
CREATE INDEX IF NOT EXISTS idx_dictionaries_phrase_gin 
ON dictionaries USING GIN (to_tsvector('simple', phrase));

-- =============================================================================
-- 3. パーシャルインデックス（条件付きインデックス）
-- =============================================================================

-- アクティブなチェックのみ
CREATE INDEX IF NOT EXISTS idx_checks_active 
ON checks(organization_id, user_id, created_at DESC)
WHERE deleted_at IS NULL;

-- 失敗したチェックの分析用
CREATE INDEX IF NOT EXISTS idx_checks_failed_analysis 
ON checks(organization_id, status, error_message)
WHERE status = 'failed' AND deleted_at IS NULL;

-- 画像処理チェック専用
CREATE INDEX IF NOT EXISTS idx_checks_image_processing 
ON checks(organization_id, input_type, ocr_status, created_at)
WHERE input_type = 'image';

-- =============================================================================
-- 4. 最適化されたファンクション（パフォーマンス改善版）
-- =============================================================================

-- 高速チェック履歴取得（CTEとウィンドウ関数使用）
CREATE OR REPLACE FUNCTION get_checks_with_pagination(
    p_organization_id BIGINT,
    p_user_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id BIGINT,
    user_id UUID,
    input_type TEXT,
    original_text TEXT,
    modified_text TEXT,
    status check_status,
    created_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_count BIGINT,
    violation_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH filtered_checks AS (
        SELECT 
            c.id,
            c.user_id,
            c.input_type,
            c.original_text,
            c.modified_text,
            c.status,
            c.created_at,
            c.completed_at,
            COUNT(*) OVER() as total_count
        FROM checks c
        WHERE c.organization_id = p_organization_id
            AND c.deleted_at IS NULL
            AND (p_user_id IS NULL OR c.user_id = p_user_id)
            AND (p_status IS NULL OR c.status::TEXT = p_status)
            AND (p_search IS NULL OR 
                c.original_text ILIKE '%' || p_search || '%' OR
                to_tsvector('simple', c.original_text) @@ plainto_tsquery('simple', p_search))
        ORDER BY c.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ),
    violation_counts AS (
        SELECT 
            v.check_id,
            COUNT(*) as violation_count
        FROM violations v
        INNER JOIN filtered_checks fc ON v.check_id = fc.id
        GROUP BY v.check_id
    )
    SELECT 
        fc.id,
        fc.user_id,
        fc.input_type,
        fc.original_text,
        fc.modified_text,
        fc.status,
        fc.created_at,
        fc.completed_at,
        fc.total_count,
        COALESCE(vc.violation_count, 0) as violation_count
    FROM filtered_checks fc
    LEFT JOIN violation_counts vc ON fc.id = vc.check_id
    ORDER BY fc.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 最適化された類似フレーズ検索（統合版）
CREATE OR REPLACE FUNCTION get_combined_similar_phrases(
    input_text TEXT,
    org_id BIGINT,
    trgm_threshold FLOAT DEFAULT 0.3,
    vector_threshold FLOAT DEFAULT 0.75,
    query_embedding VECTOR DEFAULT NULL,
    max_results INTEGER DEFAULT 100
)
RETURNS TABLE (
    id BIGINT,
    phrase TEXT,
    category dictionary_category,
    trgm_similarity FLOAT,
    vector_similarity FLOAT,
    combined_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH trgm_results AS (
        SELECT 
            d.id,
            d.phrase,
            d.category,
            similarity(d.phrase, input_text) as trgm_sim,
            0.0 as vector_sim
        FROM dictionaries d
        WHERE d.organization_id = org_id
            AND similarity(d.phrase, input_text) >= trgm_threshold
    ),
    vector_results AS (
        SELECT 
            d.id,
            d.phrase,
            d.category,
            0.0 as trgm_sim,
            CASE 
                WHEN query_embedding IS NOT NULL AND d.vector IS NOT NULL
                THEN 1 - (d.vector <=> query_embedding)
                ELSE 0.0
            END as vector_sim
        FROM dictionaries d
        WHERE d.organization_id = org_id
            AND query_embedding IS NOT NULL
            AND d.vector IS NOT NULL
            AND (1 - (d.vector <=> query_embedding)) >= vector_threshold
    ),
    combined_results AS (
        SELECT 
            COALESCE(t.id, v.id) as id,
            COALESCE(t.phrase, v.phrase) as phrase,
            COALESCE(t.category, v.category) as category,
            GREATEST(COALESCE(t.trgm_sim, 0), COALESCE(v.trgm_sim, 0)) as trgm_similarity,
            GREATEST(COALESCE(t.vector_sim, 0), COALESCE(v.vector_sim, 0)) as vector_similarity
        FROM trgm_results t
        FULL OUTER JOIN vector_results v ON t.id = v.id
    )
    SELECT 
        cr.id,
        cr.phrase,
        cr.category,
        cr.trgm_similarity,
        cr.vector_similarity,
        -- 統合スコア算出（trgm: 30%, vector: 70%）
        (cr.trgm_similarity * 0.3 + cr.vector_similarity * 0.7) as combined_score
    FROM combined_results cr
    ORDER BY combined_score DESC, cr.vector_similarity DESC, cr.trgm_similarity DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- 5. 統計・監視用ファンクション
-- =============================================================================

-- 組織のパフォーマンス統計取得
CREATE OR REPLACE FUNCTION get_organization_performance_stats(
    org_id BIGINT,
    days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_checks BIGINT,
    avg_processing_time_seconds FLOAT,
    success_rate FLOAT,
    most_common_violations TEXT[],
    peak_usage_hour INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH check_stats AS (
        SELECT 
            COUNT(*) as total,
            AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_processing_time,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate,
            EXTRACT(HOUR FROM created_at) as hour_of_day
        FROM checks
        WHERE organization_id = org_id
            AND created_at >= NOW() - make_interval(days => days_back)
            AND deleted_at IS NULL
        GROUP BY EXTRACT(HOUR FROM created_at)
    ),
    violation_stats AS (
        SELECT 
            ARRAY_AGG(reason ORDER BY violation_count DESC) as common_violations
        FROM (
            SELECT 
                v.reason,
                COUNT(*) as violation_count
            FROM violations v
            INNER JOIN checks c ON v.check_id = c.id
            WHERE c.organization_id = org_id
                AND c.created_at >= NOW() - make_interval(days => days_back)
                AND c.deleted_at IS NULL
            GROUP BY v.reason
            ORDER BY violation_count DESC
            LIMIT 10
        ) top_violations
    )
    SELECT 
        SUM(cs.total) as total_checks,
        AVG(cs.avg_processing_time) as avg_processing_time_seconds,
        AVG(cs.success_rate) as success_rate,
        vs.common_violations as most_common_violations,
        (SELECT cs2.hour_of_day::INTEGER 
         FROM check_stats cs2 
         ORDER BY cs2.total DESC 
         LIMIT 1) as peak_usage_hour
    FROM check_stats cs
    CROSS JOIN violation_stats vs
    GROUP BY vs.common_violations;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- 6. インデックス使用状況監視
-- =============================================================================

-- インデックス使用率チェック用ビュー
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    relname AS tablename,
    indexrelname AS indexname,
    idx_scan AS times_used,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW_USAGE'
        ELSE 'ACTIVE'
    END AS usage_category
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- 遅いクエリ検出用ファンクション（開発・デバッグ用）
CREATE OR REPLACE FUNCTION analyze_slow_queries()
RETURNS TABLE (
    query_text TEXT,
    calls BIGINT,
    total_time FLOAT,
    avg_time FLOAT
) AS $$
BEGIN
    -- This requires pg_stat_statements extension
    RETURN QUERY
    SELECT 
        LEFT(pss.query, 100) as query_text,
        pss.calls as calls,
        pss.total_exec_time / 1000.0 as total_time,
        (pss.total_exec_time / pss.calls) / 1000.0 as avg_time
    FROM pg_stat_statements pss
    WHERE query ILIKE '%checks%' OR query ILIKE '%dictionaries%'
    ORDER BY total_exec_time DESC
    LIMIT 20;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'pg_stat_statements extension not installed';
        RETURN;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7. データベース接続プール最適化設定（コメント）
-- =============================================================================

-- アプリ側での推奨セッション設定（参考値）
-- work_mem = '16MB'
-- shared_buffers = '256MB'
-- max_connections = 100
-- effective_cache_size = '1GB'

COMMENT ON INDEX idx_checks_org_status_created IS 'チェック履歴高速検索用複合インデックス';
COMMENT ON INDEX idx_checks_original_text_gin IS '日本語フルテキスト検索用GINインデックス';
COMMENT ON FUNCTION get_checks_with_pagination IS '最適化されたページネーション付きチェック取得';
COMMENT ON FUNCTION get_combined_similar_phrases IS '統合された類似フレーズ検索（trgm+vector）';


