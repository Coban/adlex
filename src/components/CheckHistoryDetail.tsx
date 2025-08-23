'use client'

import { useState } from 'react'

// モジュール化されたフック群

// モジュール化されたコンポーネント群
import { CheckHeader } from './CheckHistoryDetail/components/CheckHeader'
import { CheckMetadata } from './CheckHistoryDetail/components/CheckMetadata'
import { LoadingState, ErrorState, NotFoundState } from './CheckHistoryDetail/components/LoadingStates'
import { TextTabs } from './CheckHistoryDetail/components/TextTabs'
import { ViolationsList } from './CheckHistoryDetail/components/ViolationsList'
import { useCheckActions } from './CheckHistoryDetail/hooks/useCheckActions'
import { useCheckDetail } from './CheckHistoryDetail/hooks/useCheckDetail'

// 型定義
import { CheckHistoryDetailProps } from './CheckHistoryDetail/types'

export default function CheckHistoryDetail({ checkId }: CheckHistoryDetailProps) {
  const [showViolations, setShowViolations] = useState(true)

  // データ取得フック
  const { check, loading, error } = useCheckDetail(checkId)

  // アクション処理フック
  const {
    copyToClipboard,
    copyDiffFormat,
    handleRerun,
    handlePdfDownload,
    handleDelete,
  } = useCheckActions(check)

  // ローディング状態の処理
  if (loading) {
    return <LoadingState />
  }

  if (error) {
    return <ErrorState error={error} />
  }

  if (!check) {
    return <NotFoundState />
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー・ナビゲーション */}
      <CheckHeader
        check={check}
        showViolations={showViolations}
        onToggleViolations={() => setShowViolations(!showViolations)}
        onRerun={handleRerun}
        onCopyDiff={copyDiffFormat}
        onPdfDownload={handlePdfDownload}
        onDelete={handleDelete}
      />

      {/* メタデータ */}
      <CheckMetadata check={check} />

      {/* テキスト表示タブ */}
      <TextTabs
        check={check}
        showViolations={showViolations}
        onCopyText={copyToClipboard}
      />

      {/* 違反一覧 */}
      <ViolationsList check={check} />
    </div>
  )
}