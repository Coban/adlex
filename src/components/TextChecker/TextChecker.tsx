/**
 * TextChecker メインコンポーネント
 * 分割されたhooksとcomponentsを統合した新しいアーキテクチャ
 */

'use client'

import React, { useState, useCallback } from 'react'
import { AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { logger } from '@/lib/logger'
import { CheckItem } from '@/types'

import { CheckInput } from './components/CheckInput'
import { CheckResults } from './components/CheckResults'
import { CheckHistory } from './components/CheckHistory'
import { useCheckState } from './hooks/useCheckState'
import { useErrorHandling } from './hooks/useErrorHandling'
import { useClipboard } from './hooks/useClipboard'
import { useStreamUpdates } from './hooks/useStreamUpdates'

export interface TextCheckerProps {
  className?: string
}

/**
 * TextChecker統合コンポーネント
 * 薬機法チェック機能の全体的な UI とロジックを管理
 */
export function TextChecker({ className }: TextCheckerProps) {
  // 状態管理
  const [selectedCheck, setSelectedCheck] = useState<CheckItem | null>(null)
  
  // フック統合
  const checkState = useCheckState()
  const errorHandling = useErrorHandling()
  const clipboard = useClipboard()

  // SSE管理用状態
  const [dictionaryInfo, setDictionaryInfo] = useState<{ [key: number]: { phrase: string; category: 'NG' | 'ALLOW'; notes: string | null } }>({})

  // ストリーム更新フック (将来的にSSE機能統合時に使用)
  useStreamUpdates({
    activeCheckId: checkState.activeCheckId,
    updateCheck: checkState.updateCheck,
    setQueueStatus: () => {}, // 現在未使用
    setOrganizationStatus: () => {}, // 現在未使用  
    setSystemStatus: () => {}, // 現在未使用
    setDictionaryInfo
  })

  // テキストチェック開始
  const handleStartCheck = useCallback(async (text: string) => {
    try {
      errorHandling.clearAllErrors()
      
      if (!text.trim()) {
        errorHandling.setErrorMessage('テキストを入力してください')
        return
      }
      
      // 新しいチェックを作成
      const newCheck: CheckItem = {
        id: crypto.randomUUID(),
        originalText: text,
        status: 'processing',
        statusMessage: '処理開始中...',
        timestamp: Date.now(),
        result: null
      }
      
      checkState.addCheck(newCheck)
      
      // APIリクエスト送信
      const response = await fetch('/api/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })

      if (!response.ok) {
        throw new Error('チェックリクエストが失敗しました')
      }

      const data = await response.json()
      
      // データベースIDで更新 (ローカルIDは維持、ステータスメッセージ更新)
      checkState.updateCheck(newCheck.id, { 
        statusMessage: 'サーバーで処理中...'
      })
      
      logger.info('Text check started', {
        operation: 'TextChecker.handleStartCheck',
        checkId: data.checkId,
        textLength: text.length
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'チェックの開始に失敗しました'
      errorHandling.setErrorMessage(errorMessage)
      logger.error('Failed to start text check', {
        operation: 'TextChecker.handleStartCheck',
        error: errorMessage
      })
    }
  }, [checkState, errorHandling])

  // チェック詳細表示
  const handleViewDetails = useCallback((checkId: string) => {
    const check = checkState.checks.find(c => c.id === checkId)
    if (check) {
      setSelectedCheck(check)
      logger.info('Check details viewed', {
        operation: 'TextChecker.handleViewDetails',
        checkId
      })
    }
  }, [checkState.checks])

  // キャンセル処理
  const handleCancel = useCallback((checkId: string) => {
    checkState.removeCheck(checkId)
    if (selectedCheck?.id === checkId) {
      setSelectedCheck(null)
    }
  }, [checkState, selectedCheck])

  // 現在のチェック状態を取得
  const currentCheck = checkState.activeCheck

  // 表示するチェック結果
  const displayedCheck = selectedCheck ?? currentCheck

  // チェック進行状況アイコン
  const getStatusIcon = () => {
    if (!currentCheck) return null

    switch (currentCheck.status) {
      case 'processing':
        return <Clock className="h-4 w-4 animate-spin text-blue-600" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <div className={`space-y-6 ${className ?? ''}`}>
      {/* エラー表示 */}
      {errorHandling.errorMessage && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center space-x-2 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">{errorHandling.errorMessage}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* メインチェック入力エリア */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>薬機法チェック</span>
            {getStatusIcon()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CheckInput
            text={checkState.text}
            setText={checkState.setText}
            onCheck={handleStartCheck}
            isChecking={!!checkState.activeCheckId}
            characterCount={checkState.text.length}
            errorMessage={errorHandling.errorMessage}
          />
        </CardContent>
      </Card>

      {/* チェック結果表示 */}
      {displayedCheck?.result && (
        <CheckResults
          check={displayedCheck}
          onCopy={clipboard.copyToClipboard}
          onExport={() => {}}
          copySuccess={clipboard.copySuccess}
          pdfError={errorHandling.pdfError}
          highlightText={() => ''} // TODO: テキストハイライト機能の統合
          selectedViolationId={null}
          onViolationSelect={() => {}}
          dictionaryInfo={dictionaryInfo}
        />
      )}

      {/* チェック履歴 */}
      {checkState.checks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>チェック履歴</CardTitle>
          </CardHeader>
          <CardContent>
            <CheckHistory
              checks={checkState.checks}
              activeCheckId={checkState.activeCheckId}
              onSelectCheck={handleViewDetails}
              onCancelCheck={handleCancel}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default TextChecker