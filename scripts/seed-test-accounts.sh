#!/bin/bash

# テスト用アカウントをシードするスクリプト
# 開発環境でのみ使用してください

echo "🌱 テスト用アカウントをシード中..."

# Supabaseがローカルで実行されているかチェック
if ! supabase status 2>/dev/null | grep -q "API URL"; then
    echo "❌ Supabaseローカル環境が起動していません。"
    echo "以下のコマンドでSupabaseを起動してください："
    echo "supabase start"
    exit 1
fi

# シードファイルを実行
echo "📊 シードデータを挿入中..."
supabase db reset

echo "✅ テスト用アカウントのシードが完了しました！"
echo ""
echo "📝 テスト用アカウント情報："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "👨‍💼 管理者アカウント1："
echo "   メール: admin@test.com"
echo "   パスワード: password123"
echo "   組織: テスト組織A (管理者)"
echo ""
echo "👨‍💼 管理者アカウント2："
echo "   メール: manager@test.com"
echo "   パスワード: password123"
echo "   組織: テスト組織B (管理者)"
echo ""
echo "👤 一般ユーザー1："
echo "   メール: user1@test.com"
echo "   パスワード: password123"
echo "   組織: テスト組織A (一般ユーザー)"
echo ""
echo "👤 一般ユーザー2："
echo "   メール: user2@test.com"
echo "   パスワード: password123"
echo "   組織: テスト組織B (一般ユーザー)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔗 招待テスト用トークン："
echo "   newuser@test.com用: test-invitation-token-123"
echo "   newadmin@test.com用: test-invitation-token-456"
echo ""
echo "🌐 招待承認URL例："
echo "   http://localhost:3000/auth/invitation?token=test-invitation-token-123"
echo ""
echo "🏥 組織情報："
echo "   - テスト組織A: トライアル期間中（使用済み: 3回）"
echo "   - テスト組織B: ベーシックプラン（使用済み: 1回）"
echo "   - サンプル薬局: トライアル期間中（使用済み: 0回）"
echo ""
echo "💡 各組織には専用の辞書データとチェック履歴も含まれています。" 