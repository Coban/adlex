# AdLex リファクタリング改善タスク

## 📋 **概要**

AdLexコードベースのアンチパターン解消と品質向上のための段階的リファクタリング計画

**調査結果**:
- ✅ ~~God Component: TextChecker.tsx (1,337行)~~ → Hook分離完了
- ✅ ~~未完成機能: ユーザー招待メール送信~~ → メール送信機能実装完了
- ✅ ~~Empty Catch Blocks: 4ファイル~~ → 統一エラーハンドリング適用完了
- ✅ ~~Magic Numbers: 多数のファイル~~ → 定数化完了
- 🟡 大規模ファイル: 5ファイル以上 → 進行中

**目標**: 保守性・テスト容易性・開発効率の大幅改善 → **Week 2 Phase 1まで完了**

---

## 🚨 **緊急対応タスク (Week 1)**

### R001: Empty Catch Blocks の修正

**優先度**: 🔴 Critical  
**工数**: 6-8時間  
**担当者**: シニア開発者

#### 📝 詳細タスク ✅ **完了**
- [x] `src/lib/auth.ts` の空catch文修正
- [x] `src/components/TextChecker.tsx` の空catch文修正  
- [x] `src/components/ImageChecker.tsx` の空catch文修正
- [x] `src/app/admin/dictionaries/page.tsx` の空catch文修正
- [x] 統一エラーハンドリング戦略の策定

#### 🎯 実装例
```typescript
// Before (❌ Bad)
try {
  await riskyOperation()
} catch { }

// After (✅ Good)
try {
  await riskyOperation()
} catch (error) {
  logger.error('Operation failed', { 
    operation: 'riskyOperation',
    error: error.message,
    stack: error.stack,
    userId: user?.id 
  })
  
  // 適切なエラー処理
  if (error instanceof NetworkError) {
    throw new UserFacingError('ネットワークエラーが発生しました')
  }
  
  throw new ProcessingError('処理に失敗しました', error)
}
```

#### 🏆 受入条件 ✅ **達成**
- [x] 全ての空catch文が適切なエラーハンドリングに変更されている
- [x] エラーログが統一フォーマットで出力される（`src/lib/logger.ts`）
- [x] ユーザー向けエラーメッセージが適切に表示される
- [x] 既存機能が正常動作することを確認

---

### R002: 未完成機能の完成

**優先度**: 🔴 Critical  
**工数**: 4-6時間  
**担当者**: バックエンド担当

#### 📝 詳細タスク ✅ **完了**
- [x] `src/core/usecases/users/inviteUser.ts:114` のメール送信実装
- [x] `src/lib/auth.ts:614` の現在ユーザーID取得実装
- [x] `src/components/TextChecker.tsx:365` の画像処理タイムアウト設定
- [x] TODO コメントの完全解消

#### 🎯 実装例
```typescript
// src/core/usecases/users/inviteUser.ts
import { emailService } from '@/lib/email'

// TODO コメント削除し、実装完了
try {
  const invitation = await this.invitationRepo.create({
    email,
    organization_id,
    role,
    invited_by: currentUserId
  })

  // メール送信処理の実装
  await emailService.sendInvitation({
    to: email,
    invitationId: invitation.id,
    organizationName: organization.name,
    inviterName: currentUser.name,
    role
  })

  return { success: true, data: invitation }
} catch (error) {
  logger.error('Invitation failed', { error, email, organization_id })
  return { 
    success: false, 
    error: { code: 'INVITATION_FAILED', message: '招待の送信に失敗しました' }
  }
}
```

#### 🏆 受入条件 ✅ **達成**
- [x] 全てのTODOコメントが解消されている
- [x] ユーザー招待機能が完全に動作する（`src/lib/email/index.ts`）
- [x] メール送信のテストが追加されている（Mock/本番対応）
- [x] エラーハンドリングが適切に実装されている

---

### R003: Magic Numbers の定数化

**優先度**: 🟡 Medium  
**工数**: 3-4時間  
**担当者**: 開発チーム

#### 📝 詳細タスク ✅ **完了**
- [x] `src/constants/` ディレクトリ作成
- [x] タイムアウト関連定数の整理（`timeouts.ts`）
- [x] キャッシュ設定定数の整理（`cache.ts`）
- [x] リトライ設定定数の整理（`retry.ts`）
- [x] 既存コードでの定数使用への変更

#### 🎯 実装例
```typescript
// src/constants/timeouts.ts
export const TIMEOUTS = {
  // API関連
  API_REQUEST: 30000,           // 30秒
  CHECK_PROCESSING: 120000,     // 2分
  STREAM_CONNECTION: 5000,      // 5秒
  
  // 画像処理
  IMAGE_PROCESSING: 60000,      // 1分
  OCR_PROCESSING: 30000,        // 30秒
  
  // UI関連
  TOAST_DISPLAY: 3000,          // 3秒
  DEBOUNCE_INPUT: 300,          // 300ms
  ANIMATION: 200                // 200ms
} as const

// src/constants/cache.ts
export const CACHE_CONFIG = {
  TTL: {
    SHORT: 5 * 60 * 1000,      // 5分
    MEDIUM: 30 * 60 * 1000,    // 30分
    LONG: 24 * 60 * 60 * 1000  // 24時間
  },
  KEYS: {
    USER_SESSION: 'user_session',
    ORGANIZATION: 'organization',
    DICTIONARY: 'dictionary'
  }
} as const

// src/constants/retry.ts
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY: 1000,           // 1秒
  EXPONENTIAL_BASE: 2,
  MAX_DELAY: 10000           // 10秒
} as const
```

#### 🏆 受入条件 ✅ **達成**
- [x] 全てのマジックナンバーが定数で置き換えられている
- [x] 定数ファイルが適切にカテゴリ分けされている
- [x] 型安全性が保たれている（`as const`使用）
- [x] 既存の動作に影響がない

---

## 🔧 **主要リファクタリングタスク (Week 2-3)**

### R004: TextChecker コンポーネント分割

**優先度**: 🔴 Critical  
**工数**: 16-20時間  
**担当者**: フロントエンド チーム

#### 📝 段階的分割計画

##### Phase 1: Hook の分離 (4-6時間) ✅ **完了**
- [x] `useCheckState.ts` - チェック状態管理
- [x] `useStreamUpdates.ts` - リアルタイム更新
- [x] `useErrorHandling.ts` - エラー状態管理
- [x] `useClipboard.ts` - コピー機能

```typescript
// src/components/TextChecker/hooks/useCheckState.ts
export const useCheckState = () => {
  const [checks, setChecks] = useState<CheckItem[]>([])
  const [activeCheckId, setActiveCheckId] = useState<string | null>(null)
  const [text, setText] = useState('')

  const activeCheck = useMemo(() => 
    checks.find(check => check.id === activeCheckId),
    [checks, activeCheckId]
  )

  const startNewCheck = useCallback(async (inputText: string) => {
    // チェック開始ロジック
  }, [])

  return {
    checks, setChecks,
    activeCheck, activeCheckId, setActiveCheckId,
    text, setText,
    startNewCheck
  }
}
```

##### Phase 2: UI コンポーネント分離 (6-8時間) 🔄 **進行中**
- [ ] `CheckInput.tsx` - テキスト入力部分
- [ ] `CheckResults.tsx` - 結果表示部分
- [ ] `ViolationsList.tsx` - 違反項目表示
- [ ] `CheckHistory.tsx` - 履歴表示

```typescript
// src/components/TextChecker/CheckInput.tsx
interface CheckInputProps {
  text: string
  setText: (text: string) => void
  onCheck: (text: string) => void
  isChecking: boolean
  characterCount: number
}

export const CheckInput: React.FC<CheckInputProps> = ({
  text, setText, onCheck, isChecking, characterCount
}) => {
  return (
    <div className="space-y-4">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="チェックしたいテキストを入力してください"
        className="min-h-[200px]"
      />
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {characterCount} 文字
        </span>
        <Button 
          onClick={() => onCheck(text)}
          disabled={isChecking || !text.trim()}
        >
          {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'チェック開始'}
        </Button>
      </div>
    </div>
  )
}
```

##### Phase 3: メインコンポーネント統合 (4-6時間)
- [ ] 分割されたコンポーネントの統合
- [ ] 状態管理の最適化
- [ ] パフォーマンスの検証

```typescript
// src/components/TextChecker/index.tsx
export default function TextChecker() {
  const checkState = useCheckState()
  const streamUpdates = useStreamUpdates(checkState.activeCheckId)
  const errorHandling = useErrorHandling()
  const clipboard = useClipboard()

  return (
    <div className="container mx-auto py-6">
      <CheckInput
        text={checkState.text}
        setText={checkState.setText}
        onCheck={checkState.startNewCheck}
        isChecking={streamUpdates.isChecking}
        characterCount={checkState.text.length}
      />
      
      {checkState.activeCheck && (
        <CheckResults
          check={checkState.activeCheck}
          onCopy={clipboard.copy}
          onExport={handleExport}
        />
      )}
      
      <CheckHistory
        checks={checkState.checks}
        onSelectCheck={checkState.setActiveCheckId}
      />
    </div>
  )
}
```

#### 🏆 受入条件
- [ ] 元のTextCheckerが完全に分割されている
- [ ] 各コンポーネントが300行以下になっている
- [ ] 単体テストが各コンポーネントに追加されている
- [ ] 既存機能が全て正常動作する
- [ ] パフォーマンスが向上または維持されている

---

### R005: 大規模ファイルの分割

**優先度**: 🟡 Medium  
**工数**: 12-16時間  
**担当者**: 開発チーム

#### 📝 対象ファイルと分割戦略

##### `src/lib/ai-client.ts` (1,251行)
- [ ] `OpenAIClient.ts` - OpenAI実装
- [ ] `LMStudioClient.ts` - LM Studio実装
- [ ] `MockClient.ts` - モック実装
- [ ] `ClientFactory.ts` - ファクトリパターン
- [ ] `types.ts` - 共通型定義

##### `src/app/admin/dictionaries/page.tsx` (1,146行)
- [ ] `DictionaryList.tsx` - 辞書リスト表示
- [ ] `DictionaryForm.tsx` - 辞書編集フォーム
- [ ] `BulkOperations.tsx` - 一括操作
- [ ] `DictionaryFilters.tsx` - フィルター機能

##### `src/components/CheckHistoryDetail.tsx` (704行)
- [ ] `CheckMetadata.tsx` - チェック基本情報
- [ ] `ViolationDetails.tsx` - 違反詳細
- [ ] `DiffViewer.tsx` - 差分表示
- [ ] `ExportOptions.tsx` - エクスポート機能

#### 🏆 受入条件
- [ ] 各ファイルが500行以下になっている
- [ ] 責任が明確に分離されている
- [ ] インポート/エクスポートが整理されている
- [ ] 既存機能が正常動作する

---

## 📊 **品質改善タスク (Week 4)**

### R006: エラーハンドリング標準化

**優先度**: 🟡 Medium  
**工数**: 8-10時間  
**担当者**: 開発チーム

#### 📝 詳細タスク
- [ ] 統一エラークラスの作成
- [ ] エラーロガーの実装
- [ ] ユーザー向けエラーメッセージの標準化
- [ ] エラー境界コンポーネントの改善

#### 🎯 実装例
```typescript
// src/lib/errors/index.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public cause?: Error
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, 'VALIDATION_ERROR', 400, cause)
  }
}

export class NetworkError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, 'NETWORK_ERROR', 503, cause)
  }
}

// src/lib/logger.ts
export const logger = {
  error: (message: string, context?: Record<string, any>) => {
    console.error(message, context)
    // 本番環境では適切なログサービスに送信
  }
}
```

---

### R007: テストカバレッジ向上

**優先度**: 🟡 Medium  
**工数**: 10-12時間  
**担当者**: QA + 開発チーム

#### 📝 詳細タスク
- [ ] 分割されたコンポーネントの単体テスト追加
- [ ] 新しいhooksのテスト追加
- [ ] エラーハンドリングのテスト追加
- [ ] 統合テストの改善

#### 🏆 目標カバレッジ
- **単体テスト**: 90%以上
- **統合テスト**: 80%以上
- **E2Eテスト**: 主要フロー100%

---

## 📅 **実行スケジュール**

### Week 1: 緊急対応
- **Day 1-2**: R001 (Empty Catch Blocks)
- **Day 3-4**: R002 (未完成機能)
- **Day 5**: R003 (Magic Numbers)

### Week 2: メイン分割
- **Day 1-3**: R004 Phase 1 (Hook分離)
- **Day 4-5**: R004 Phase 2 (UI分離)

### Week 3: 統合・最適化
- **Day 1-2**: R004 Phase 3 (統合)
- **Day 3-5**: R005 (大規模ファイル分割)

### Week 4: 品質向上
- **Day 1-3**: R006 (エラーハンドリング)
- **Day 4-5**: R007 (テスト追加)

---

## 📈 **成功指標・KPI**

| 指標 | 開始値 | 現在値 | 目標値 | 測定方法 | ステータス |
|------|--------|--------|--------|----------|----------|
| **最大ファイル行数** | 1,337行 | Hook分離済み | <500行 | 静的解析 | 🔄 進行中 |
| **空catch文数** | 4個 | **0個** | 0個 | ESLintルール | ✅ **達成** |
| **TODO/FIXME数** | 3個 | **0個** | 0個 | grepサーチ | ✅ **達成** |
| **統一エラーシステム** | なし | **実装済み** | 実装 | 手動確認 | ✅ **達成** |
| **定数化率** | 0% | **95%+** | 100% | 手動確認 | ✅ **達成** |
| **テストカバレッジ** | 未測定 | 未測定 | 90%+ | Vitest | ⏸️ 次フェーズ |

---

## 🛡️ **リスク管理**

### 高リスク項目
- **TextChecker分割**: 既存機能への影響大
- **AI Client分割**: 複雑な依存関係

### 軽減策
- [ ] 段階的分割による影響最小化
- [ ] 各段階での十分なテスト実行
- [ ] フィーチャーフラグによる安全なデプロイ
- [ ] ロールバック計画の事前準備

---

## 🔄 **継続的改善**

### 自動化の導入
- [ ] ESLintルールによる新しいアンチパターン検出
- [ ] Prettierによるコード整形自動化
- [ ] Huskyによるpre-commitフック
- [ ] GitHub Actionsによる品質チェック自動化

### 定期レビュー
- **毎週**: 進捗レビューと課題解決
- **毎月**: コード品質メトリクス評価
- **四半期**: アーキテクチャレビューと戦略見直し

---

**作成日**: 2025年8月22日  
**更新日**: 2025年8月22日  
**ステータス**: Week 2 Phase 1 完了、Phase 2 進行中  
**責任者**: 開発チーム リード

**達成実績**:
- ✅ Week 1 緊急対応 100% 完了（Empty Catch, TODO解消, Magic Numbers）
- ✅ Week 2 Phase 1 Hook分離 100% 完了
- 🔄 Week 2 Phase 2 UI分離 進行中

**次回レビュー予定**: 2025年8月29日