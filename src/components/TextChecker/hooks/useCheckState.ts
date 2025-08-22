/**
 * TextChecker チェック状態管理Hook
 * チェック一覧、アクティブチェック、テキスト状態を管理
 */

import { useState, useMemo, useCallback } from 'react'
import { CheckItem } from '@/types'

export interface UseCheckStateReturn {
  // State
  checks: CheckItem[]
  activeCheckId: string | null
  text: string
  
  // Computed
  activeCheck: CheckItem | null
  hasActiveCheck: boolean
  
  // Actions
  setChecks: React.Dispatch<React.SetStateAction<CheckItem[]>>
  setActiveCheckId: React.Dispatch<React.SetStateAction<string | null>>
  setText: React.Dispatch<React.SetStateAction<string>>
  
  // Methods
  addCheck: (check: CheckItem) => void
  updateCheck: (id: string, updates: Partial<CheckItem>) => void
  removeCheck: (id: string) => void
  clearAllChecks: () => void
}

export function useCheckState(): UseCheckStateReturn {
  const [checks, setChecks] = useState<CheckItem[]>([])
  const [activeCheckId, setActiveCheckId] = useState<string | null>(null)
  const [text, setText] = useState('')

  // アクティブなチェック結果を取得
  const activeCheck = useMemo(() => (
    activeCheckId ? checks.find(check => check.id === activeCheckId) : null
  ), [activeCheckId, checks])

  const hasActiveCheck = useMemo(() => !!activeCheck?.result, [activeCheck?.result])

  // チェックを追加
  const addCheck = useCallback((check: CheckItem) => {
    setChecks(prev => [...prev, check])
    setActiveCheckId(check.id)
  }, [])

  // チェックを更新
  const updateCheck = useCallback((id: string, updates: Partial<CheckItem>) => {
    setChecks(prev => prev.map(check => 
      check.id === id ? { ...check, ...updates } : check
    ))
  }, [])

  // チェックを削除
  const removeCheck = useCallback((id: string) => {
    setChecks(prev => prev.filter(check => check.id !== id))
    setActiveCheckId(prev => prev === id ? null : prev)
  }, [])

  // 全チェックをクリア
  const clearAllChecks = useCallback(() => {
    setChecks([])
    setActiveCheckId(null)
  }, [])

  return {
    // State
    checks,
    activeCheckId,
    text,
    
    // Computed
    activeCheck,
    hasActiveCheck,
    
    // Actions
    setChecks,
    setActiveCheckId,
    setText,
    
    // Methods
    addCheck,
    updateCheck,
    removeCheck,
    clearAllChecks
  }
}