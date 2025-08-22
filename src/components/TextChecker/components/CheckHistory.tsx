/**
 * TextChecker チェック履歴コンポーネント
 * チェック履歴の表示と選択機能を管理
 */

import React from 'react'
import { CheckItem } from '@/types'

export interface CheckHistoryProps {
  checks: CheckItem[]
  activeCheckId: string | null
  onSelectCheck: (checkId: string) => void
  onCancelCheck?: (checkId: string) => void
}

export const CheckHistory: React.FC<CheckHistoryProps> = ({
  checks,
  activeCheckId,
  onSelectCheck,
  onCancelCheck
}) => {
  if (checks.length === 0) {
    return (
      <div className="border rounded p-8 text-center text-gray-500">
        まだチェック履歴がありません
      </div>
    )
  }

  const getStatusDisplay = (check: CheckItem) => {
    switch (check.status) {
      case 'processing':
        return {
          color: 'bg-blue-500',
          text: '処理中',
          icon: <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        }
      case 'completed':
        return {
          color: 'bg-green-500',
          text: '完了',
          icon: <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        }
      case 'failed':
        return {
          color: 'bg-red-500',
          text: 'エラー',
          icon: <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        }
      case 'cancelled':
        return {
          color: 'bg-gray-500',
          text: 'キャンセル',
          icon: <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
        }
      default:
        return {
          color: 'bg-yellow-500',
          text: 'キューイング',
          icon: <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
        }
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">チェック履歴</h3>
      
      <div className="space-y-2">
        {checks.map((check) => {
          const status = getStatusDisplay(check)
          const isActive = activeCheckId === check.id
          const isProcessing = check.status === 'processing' || check.status === 'queued'
          
          return (
            <div
              key={check.id}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                isActive 
                  ? 'bg-blue-100 border-blue-300' 
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
              onClick={() => onSelectCheck(check.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  {/* ステータスアイコン */}
                  <div className="flex items-center space-x-2">
                    {status.icon}
                    <span className="text-sm font-medium">{status.text}</span>
                  </div>
                  
                  {/* プレビューテキスト */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">
                      {check.originalText.slice(0, 50)}
                      {check.originalText.length > 50 ? '...' : ''}
                    </p>
                    {check.statusMessage && (
                      <p className="text-xs text-gray-500 mt-1" data-testid="status-message">
                        {check.statusMessage}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* アクション */}
                <div className="flex items-center space-x-2">
                  {/* 結果サマリー */}
                  {check.result && (
                    <span className="text-xs text-gray-500">
                      {check.result.violations.length}件の違反
                    </span>
                  )}
                  
                  {/* キャンセルボタン */}
                  {isProcessing && onCancelCheck && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onCancelCheck(check.id)
                      }}
                      className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                      title="チェックをキャンセル"
                    >
                      キャンセル
                    </button>
                  )}
                </div>
              </div>

              {/* キューポジション表示 */}
              {check.queuePosition && check.queuePosition > 1 && (
                <div className="mt-2 text-xs text-gray-500">
                  キュー位置: {check.queuePosition}番目
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}