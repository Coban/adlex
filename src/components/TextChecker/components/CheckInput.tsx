/**
 * TextChecker テキスト入力コンポーネント
 * テキスト入力、文字数表示、チェック開始ボタンを管理
 */

import React from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { APP_CONFIG } from '@/constants'

export interface CheckInputProps {
  text: string
  setText: (text: string) => void
  onCheck: (text: string) => void
  isChecking: boolean
  characterCount: number
  errorMessage?: string | null
}

export const CheckInput: React.FC<CheckInputProps> = ({
  text,
  setText,
  onCheck,
  isChecking,
  characterCount,
  errorMessage
}) => {
  const handleSubmit = () => {
    if (text.trim()) {
      onCheck(text)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const isOverLimit = characterCount > APP_CONFIG.TEXT_LIMITS.MAX_LENGTH
  const canSubmit = text.trim() && !isChecking && !isOverLimit

  return (
    <div className="space-y-4">
      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ここにテキストを入力してください..."
          className="min-h-[400px] resize-none"
          maxLength={APP_CONFIG.TEXT_LIMITS.MAX_LENGTH}
          aria-label="薬機法チェック用テキスト入力"
          disabled={isChecking}
        />
        
        {/* 文字数とボタンの表示 */}
        <div className="flex justify-between items-center mt-2">
          <span 
            className={`text-sm ${
              isOverLimit 
                ? 'text-red-600 font-medium' 
                : 'text-gray-500'
            }`}
          >
            {characterCount.toLocaleString()} / {APP_CONFIG.TEXT_LIMITS.MAX_LENGTH.toLocaleString()} 文字
          </span>
          
          <div className="flex items-center gap-2">
            {/* Ctrl+Enter ヒント */}
            <span className="text-xs text-gray-400 hidden sm:inline">
              Ctrl+Enter でチェック開始
            </span>
            
            <Button 
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="min-w-[120px]"
              data-testid="check-button"
            >
              {isChecking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  チェック中...
                </>
              ) : (
                'チェック開始'
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* エラーメッセージ表示 */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{errorMessage}</p>
        </div>
      )}

      {/* 文字数制限警告 */}
      {isOverLimit && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-800 text-sm">
            テキストが制限文字数を超えています。{APP_CONFIG.TEXT_LIMITS.MAX_LENGTH.toLocaleString()}文字以内に収めてください。
          </p>
        </div>
      )}
    </div>
  )
}