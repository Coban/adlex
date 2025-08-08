-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create enums
CREATE TYPE organization_plan AS ENUM ('trial', 'basic');
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE dictionary_category AS ENUM ('NG', 'ALLOW');
CREATE TYPE check_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Create organizations table
CREATE TABLE organizations (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    plan organization_plan DEFAULT 'trial',
    max_checks INTEGER DEFAULT 200,
    used_checks INTEGER DEFAULT 0,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table (extends Supabase auth.users)
CREATE TABLE users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
    role user_role DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create dictionaries table
CREATE TABLE dictionaries (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    phrase TEXT NOT NULL,
    category dictionary_category NOT NULL DEFAULT 'NG',
    notes TEXT,
    vector VECTOR(384), -- OpenAI text-embedding-3-small dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create checks table
CREATE TABLE checks (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    input_type TEXT DEFAULT 'text' CHECK (input_type IN ('text', 'image')),
    original_text TEXT NOT NULL,
    extracted_text TEXT, -- OCR extracted text for images
    image_url TEXT, -- URL to uploaded image file
    ocr_status TEXT DEFAULT 'not_required' CHECK (ocr_status IN ('not_required', 'pending', 'processing', 'completed', 'failed')),
    ocr_metadata JSONB, -- OCR processing details and metadata
    modified_text TEXT,
    status check_status DEFAULT 'pending',
    error_message TEXT, -- Error message for failed checks
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create violations table
CREATE TABLE violations (
    id BIGSERIAL PRIMARY KEY,
    check_id BIGINT NOT NULL REFERENCES checks(id) ON DELETE CASCADE,
    start_pos INTEGER NOT NULL,
    end_pos INTEGER NOT NULL,
    reason TEXT NOT NULL,
    dictionary_id BIGINT REFERENCES dictionaries(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_dictionaries_organization_id ON dictionaries(organization_id);
CREATE INDEX idx_dictionaries_phrase_trgm ON dictionaries USING GIN (phrase gin_trgm_ops);
CREATE INDEX idx_dictionaries_vector ON dictionaries USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_dictionaries_category ON dictionaries(category);

CREATE INDEX idx_checks_user_id ON checks(user_id);
CREATE INDEX idx_checks_organization_id ON checks(organization_id);
CREATE INDEX idx_checks_status ON checks(status);
CREATE INDEX idx_checks_input_type ON checks(input_type);
CREATE INDEX idx_checks_ocr_status ON checks(ocr_status);
CREATE INDEX idx_checks_created_at ON checks(created_at);
CREATE INDEX idx_checks_deleted_at ON checks(deleted_at);

CREATE INDEX idx_violations_check_id ON violations(check_id);
CREATE INDEX idx_violations_dictionary_id ON violations(dictionary_id);

-- Create RLS (Row Level Security) policies
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dictionaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

-- Organizations policies
CREATE POLICY "Users can view their own organization" ON organizations
    FOR SELECT USING (id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Admins can update their organization" ON organizations
    FOR UPDATE USING (id IN (
        SELECT organization_id FROM users 
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- Users policies
CREATE POLICY "Users can view users in their organization" ON users
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins can manage users in their organization" ON users
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Dictionaries policies
CREATE POLICY "Users can view dictionaries in their organization" ON dictionaries
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage dictionaries in their organization" ON dictionaries
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Checks policies
CREATE POLICY "Users can view checks in their organization" ON checks
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create their own checks" ON checks
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own checks" ON checks
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can soft delete their own checks" ON checks
    FOR UPDATE USING (user_id = auth.uid());

-- Violations policies
CREATE POLICY "Users can view violations for accessible checks" ON violations
    FOR SELECT USING (
        check_id IN (
            SELECT id FROM checks 
            WHERE organization_id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()
            )
        )
    );

-- Create functions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_dictionaries_updated_at
    BEFORE UPDATE ON dictionaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.phrase,
        d.category,
        similarity(d.phrase, input_text) as sim
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
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.phrase,
        d.category,
        1 - (d.vector <=> query_embedding) as sim
    FROM dictionaries d
    WHERE d.vector IS NOT NULL
        AND (org_id IS NULL OR d.organization_id = org_id)
        AND (1 - (d.vector <=> query_embedding)) >= similarity_threshold
    ORDER BY d.vector <=> query_embedding
    LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- Function to increment organization usage
CREATE OR REPLACE FUNCTION increment_organization_usage(org_id BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE organizations 
    SET used_checks = used_checks + 1
    WHERE id = org_id;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data for development
INSERT INTO organizations (name, plan, max_checks) VALUES 
('サンプル組織', 'trial', 200);

-- Note: Users will be automatically created via Supabase Auth
-- You can manually insert a user after signup:
-- INSERT INTO users (id, email, organization_id, role) VALUES 
-- ('user-uuid-from-auth', 'admin@example.com', 1, 'admin');

-- Sample dictionary entries
INSERT INTO dictionaries (organization_id, phrase, category, notes) VALUES 
(1, '病気が治る', 'NG', '医薬品的効果効能の標榜'),
(1, '症状が改善', 'NG', '医療効果の標榜'),
(1, '健康をサポート', 'ALLOW', '一般的な健康維持表現'),
(1, 'ダイエット効果', 'NG', '痩身効果の標榜'),
(1, '美肌効果', 'NG', '化粧品の範囲を超える効果'),
(1, 'リフレッシュ', 'ALLOW', '一般的な気分転換表現'),
(1, '疲労回復', 'NG', '医薬品的効果'),
(1, '栄養補給', 'ALLOW', '食品の一般的機能'),
(1, 'アンチエイジング', 'NG', '老化防止効果の標榜'),
(1, '体調を整える', 'ALLOW', '一般的な体調管理表現');

-- Create a function to automatically handle user creation from Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
