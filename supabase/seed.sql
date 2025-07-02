-- テスト用シードデータ
-- 開発環境でのテスト用アカウントとデータを作成

-- テスト用組織を作成
INSERT INTO organizations (name, plan, max_checks, used_checks, trial_ends_at) VALUES 
('テスト組織A', 'trial', 200, 5, NOW() + INTERVAL '30 days'),
('テスト組織B', 'basic', 1000, 50, NULL),
('サンプル薬局', 'trial', 200, 0, NOW() + INTERVAL '25 days')
ON CONFLICT DO NOTHING;

-- テスト用ユーザーを auth.users テーブルに作成（開発環境のみ）
-- 注意: 本番環境では絶対に使用しないでください
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    confirmation_token,
    recovery_sent_at,
    recovery_token,
    email_change_sent_at,
    email_change,
    email_change_token_new,
    email_change_token_current,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at
) VALUES 
-- 管理者アカウント1: admin@test.com / password123
(
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'admin@test.com',
    '$2b$10$zmbGY0lUeiYdt7L4/VQCfOA8NzHyGOXUGKO97XsmOQ./ooTTT9bMG',
    NOW(),
    NOW(),
    '',
    NULL,
    '',
    NULL,
    '',
    '',
    '',
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"role": "admin", "organizationName": "テスト組織A"}',
    false,
    NOW(),
    NOW(),
    NULL,
    NULL,
    '',
    '',
    NULL,
    0,
    NULL,
    '',
    NULL,
    false,
    NULL
),
-- 管理者アカウント2: manager@test.com / password123  
(
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'manager@test.com',
    '$2b$10$zmbGY0lUeiYdt7L4/VQCfOA8NzHyGOXUGKO97XsmOQ./ooTTT9bMG',
    NOW(),
    NOW(),
    '',
    NULL,
    '',
    NULL,
    '',
    '',
    '',
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"role": "admin"}',
    false,
    NOW(),
    NOW(),
    NULL,
    NULL,
    '',
    '',
    NULL,
    0,
    NULL,
    '',
    NULL,
    false,
    NULL
),
-- 一般ユーザー1: user1@test.com / password123
(
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated',
    'authenticated',
    'user1@test.com',
    '$2b$10$zmbGY0lUeiYdt7L4/VQCfOA8NzHyGOXUGKO97XsmOQ./ooTTT9bMG',
    NOW(),
    NOW(),
    '',
    NULL,
    '',
    NULL,
    '',
    '',
    '',
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"role": "user"}',
    false,
    NOW(),
    NOW(),
    NULL,
    NULL,
    '',
    '',
    NULL,
    0,
    NULL,
    '',
    NULL,
    false,
    NULL
),
-- 一般ユーザー2: user2@test.com / password123
(
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-4444-444444444444',
    'authenticated',
    'authenticated',
    'user2@test.com',
    '$2b$10$zmbGY0lUeiYdt7L4/VQCfOA8NzHyGOXUGKO97XsmOQ./ooTTT9bMG',
    NOW(),
    NOW(),
    '',
    NULL,
    '',
    NULL,
    '',
    '',
    '',
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"role": "user"}',
    false,
    NOW(),
    NOW(),
    NULL,
    NULL,
    '',
    '',
    NULL,
    0,
    NULL,
    '',
    NULL,
    false,
    NULL
)
ON CONFLICT (id) DO NOTHING;

-- auth.identitiesテーブルにも対応するレコードを作成
INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    id
) VALUES 
('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '{"sub": "11111111-1111-1111-1111-111111111111", "email": "admin@test.com", "email_verified": true, "phone_verified": false}', 'email', NOW(), NOW(), NOW(), gen_random_uuid()),
('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '{"sub": "22222222-2222-2222-2222-222222222222", "email": "manager@test.com", "email_verified": true, "phone_verified": false}', 'email', NOW(), NOW(), NOW(), gen_random_uuid()),
('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', '{"sub": "33333333-3333-3333-3333-333333333333", "email": "user1@test.com", "email_verified": true, "phone_verified": false}', 'email', NOW(), NOW(), NOW(), gen_random_uuid()),
('44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', '{"sub": "44444444-4444-4444-4444-444444444444", "email": "user2@test.com", "email_verified": true, "phone_verified": false}', 'email', NOW(), NOW(), NOW(), gen_random_uuid())
ON CONFLICT (provider_id, provider) DO NOTHING;

-- テスト用ユーザーをpublic.usersテーブルに作成
INSERT INTO users (id, email, organization_id, role) VALUES 
('11111111-1111-1111-1111-111111111111', 'admin@test.com', 1, 'admin'),
('22222222-2222-2222-2222-222222222222', 'manager@test.com', 2, 'admin'),
('33333333-3333-3333-3333-333333333333', 'user1@test.com', 1, 'user'),
('44444444-4444-4444-4444-444444444444', 'user2@test.com', 2, 'user')
ON CONFLICT (id) DO NOTHING;

-- テスト用辞書エントリを追加
INSERT INTO dictionaries (organization_id, phrase, category, notes) VALUES 
-- テスト組織A用の辞書
(1, 'がんが治る', 'NG', '重篤な疾患の治療効果を標榜'),
(1, 'コロナに効く', 'NG', '感染症治療効果の標榜'),
(1, '血圧が下がる', 'NG', '医薬品的効果の標榜'),
(1, '糖尿病改善', 'NG', '疾患治療効果の標榜'),
(1, '免疫力アップ', 'NG', '医薬品的効果の標榜'),
(1, '健康維持', 'ALLOW', '一般的な健康表現'),
(1, 'おいしい', 'ALLOW', '味覚に関する表現'),
(1, '栄養豊富', 'ALLOW', '栄養成分に関する表現'),

-- テスト組織B用の辞書  
(2, 'シワが消える', 'NG', '化粧品の範囲を超える効果'),
(2, '白髪が黒くなる', 'NG', '毛髪の色調変化効果'),
(2, 'バストアップ', 'NG', '身体の構造改善効果'),
(2, 'デトックス効果', 'NG', '医薬品的効果'),
(2, 'うるおい', 'ALLOW', '化粧品の一般的効果'),
(2, 'さっぱり', 'ALLOW', '使用感の表現'),

-- サンプル薬局用の辞書
(3, '副作用なし', 'NG', '安全性の断定表現'),
(3, '天然だから安全', 'NG', '天然＝安全の誤解を招く表現'),
(3, '医師推奨', 'NG', '権威者による推奨の標榜'),
(3, '臨床試験済み', 'NG', '試験実施の根拠なき標榜'),
(3, 'さわやかな香り', 'ALLOW', '香りの表現'),
(3, '飲みやすい', 'ALLOW', '服用感の表現')
ON CONFLICT DO NOTHING;

-- テスト用チェック履歴を作成
INSERT INTO checks (user_id, organization_id, original_text, modified_text, status, completed_at) VALUES 
-- admin@test.com のチェック履歴
('11111111-1111-1111-1111-111111111111', 1, 
 'この商品は血圧が下がる効果があります。', 
 'この商品は健康維持をサポートします。', 
 'completed', NOW()),
 
('11111111-1111-1111-1111-111111111111', 1,
 'がんが治る奇跡のサプリメントです。',
 '健康維持をサポートするサプリメントです。',
 'completed', NOW() - INTERVAL '1 day'),

-- user1@test.com のチェック履歴  
('33333333-3333-3333-3333-333333333333', 1,
 'コロナに効く健康茶を販売中！',
 '健康維持に役立つ健康茶を販売中！',
 'completed', NOW() - INTERVAL '2 days'),

-- manager@test.com のチェック履歴
('22222222-2222-2222-2222-222222222222', 2,
 'シワが消えるクリームで若返り！',
 'うるおいクリームで美肌ケア！',
 'completed', NOW() - INTERVAL '3 days'),

-- 処理中のチェック
('33333333-3333-3333-3333-333333333333', 1,
 '免疫力アップで病気知らず',
 NULL,
 'processing', NULL)
ON CONFLICT DO NOTHING;

-- テスト用違反記録を作成
INSERT INTO violations (check_id, start_pos, end_pos, reason, dictionary_id) VALUES 
-- 最初のチェックの違反
(1, 5, 10, '血圧降下効果は医薬品的効果に該当します', 3),
-- 2番目のチェックの違反  
(2, 0, 6, 'がん治療効果の標榜は薬機法違反です', 1),
-- 3番目のチェックの違反
(3, 0, 7, 'コロナ治療効果の標榜は薬機法違反です', 2),
-- 4番目のチェックの違反
(4, 0, 6, 'シワ消失効果は化粧品の範囲を超えます', 9)
ON CONFLICT DO NOTHING;

-- テスト用招待レコードを作成
INSERT INTO user_invitations (organization_id, email, role, token, invited_by, expires_at) VALUES 
(1, 'newuser@test.com', 'user', 'test-invitation-token-123', '11111111-1111-1111-1111-111111111111', NOW() + INTERVAL '7 days'),
(2, 'newadmin@test.com', 'admin', 'test-invitation-token-456', '22222222-2222-2222-2222-222222222222', NOW() + INTERVAL '7 days'),
-- 期限切れの招待（テスト用）
(1, 'expired@test.com', 'user', 'expired-invitation-token', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- 組織の使用チェック数を更新
UPDATE organizations SET used_checks = 3 WHERE id = 1;
UPDATE organizations SET used_checks = 1 WHERE id = 2;
UPDATE organizations SET used_checks = 0 WHERE id = 3; 