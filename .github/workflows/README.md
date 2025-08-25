# GitHub Actions Workflows

## Claude Code Review Setup

このワークフローは、プルリクエストに対してClaude AIによる自動コードレビューを実行します。

### セットアップ手順

1. **Claude Code OAuth Tokenの取得**
   - [Claude Code](https://claude.ai/code) にアクセス
   - GitHub連携を設定
   - OAuth tokenを取得

2. **GitHub Secretsの設定**
   - リポジトリの Settings → Secrets and variables → Actions へ移動
   - "New repository secret" をクリック
   - Name: `CLAUDE_CODE_OAUTH_TOKEN`
   - Value: 取得したOAuth token
   - "Add secret" をクリック

3. **権限の確認**
   - リポジトリの Settings → Actions → General へ移動
   - "Workflow permissions" セクションで以下を確認：
     - "Read and write permissions" が選択されていること
     - または最低限 "Read repository contents and write pull requests" が許可されていること

### トラブルシューティング

#### npm install 403エラーの場合
- GitHub Actionsのレート制限に達している可能性があります
- ワークフローは自動的にNode.jsセットアップとキャッシュクリアを実行します

#### 401 Unauthorized エラーの場合
- `CLAUDE_CODE_OAUTH_TOKEN` が正しく設定されているか確認
- トークンの有効期限が切れていないか確認
- GitHub連携が有効になっているか確認

#### ワークフローがスキップされる場合
- `CLAUDE_CODE_OAUTH_TOKEN` が設定されていない場合、ワークフローは自動的にスキップされます
- PR タイトルに `[skip-review]` または `[WIP]` が含まれている場合はレビューされません（コメントアウトされた設定を有効にした場合）

### カスタマイゼーション

ワークフローファイル (`.github/workflows/claude-code-review.yml`) のコメントアウトされたセクションを編集することで、以下のカスタマイゼーションが可能です：

- 特定のファイルタイプのみレビュー
- 特定のユーザーのPRのみレビュー
- レビューの観点をカスタマイズ
- 使用するClaudeモデルの変更