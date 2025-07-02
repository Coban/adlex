-- ユーザー招待テーブルを作成
CREATE TABLE user_invitations (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role user_role DEFAULT 'user',
    token TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスを作成
CREATE INDEX idx_user_invitations_token ON user_invitations(token);
CREATE INDEX idx_user_invitations_email ON user_invitations(email);
CREATE INDEX idx_user_invitations_organization_id ON user_invitations(organization_id);
CREATE INDEX idx_user_invitations_expires_at ON user_invitations(expires_at);

-- RLS を有効化
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- 招待テーブルのポリシー
CREATE POLICY "Admins can manage invitations in their organization" ON user_invitations
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- handle_new_user 関数を更新して組織作成をサポート
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    organization_name TEXT;
    user_role TEXT;
    new_org_id BIGINT;
    trial_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- メタデータから組織名とロールを取得
    organization_name := NEW.raw_user_meta_data ->> 'organizationName';
    user_role := NEW.raw_user_meta_data ->> 'role';
    
    -- トライアル終了日を設定（30日後）
    trial_end_date := NOW() + INTERVAL '30 days';
    
    -- 組織名が指定されている場合は新しい組織を作成
    IF organization_name IS NOT NULL AND organization_name != '' THEN
        INSERT INTO organizations (name, plan, trial_ends_at)
        VALUES (organization_name, 'trial', trial_end_date)
        RETURNING id INTO new_org_id;
        
        -- 管理者として新しいユーザーを作成
        INSERT INTO users (id, email, organization_id, role)
        VALUES (NEW.id, NEW.email, new_org_id, 'admin');
    ELSE
        -- 通常のユーザー作成（既存の動作）
        INSERT INTO users (id, email, role)
        VALUES (NEW.id, NEW.email, COALESCE(user_role::user_role, 'user'));
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 招待を処理する関数
CREATE OR REPLACE FUNCTION process_user_invitation(invitation_token TEXT, user_password TEXT)
RETURNS JSON AS $$
DECLARE
    invitation_record user_invitations%ROWTYPE;
    new_user_data JSON;
BEGIN
    -- 有効な招待を取得
    SELECT * INTO invitation_record
    FROM user_invitations
    WHERE token = invitation_token
        AND expires_at > NOW()
        AND accepted_at IS NULL;
        
    IF NOT FOUND THEN
        RAISE EXCEPTION '無効または期限切れの招待リンクです';
    END IF;
    
    -- Supabase Auth でユーザーを作成
    -- この部分は実際にはクライアント側で実行される
    RETURN json_build_object(
        'email', invitation_record.email,
        'organization_id', invitation_record.organization_id,
        'role', invitation_record.role,
        'invitation_id', invitation_record.id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 招待を承認する関数
CREATE OR REPLACE FUNCTION accept_invitation(invitation_token TEXT, new_user_id UUID)
RETURNS VOID AS $$
DECLARE
    invitation_record user_invitations%ROWTYPE;
BEGIN
    -- 有効な招待を取得
    SELECT * INTO invitation_record
    FROM user_invitations
    WHERE token = invitation_token
        AND expires_at > NOW()
        AND accepted_at IS NULL;
        
    IF NOT FOUND THEN
        RAISE EXCEPTION '無効または期限切れの招待リンクです';
    END IF;
    
    -- ユーザーを組織に割り当て
    UPDATE users 
    SET organization_id = invitation_record.organization_id,
        role = invitation_record.role
    WHERE id = new_user_id;
    
    -- 招待を承認済みにマーク
    UPDATE user_invitations
    SET accepted_at = NOW()
    WHERE id = invitation_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 期限切れの招待を削除する関数
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_invitations
    WHERE expires_at < NOW() AND accepted_at IS NULL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql; 