/**
 * TextChecker エラーハンドリング管理Hook
 * エラー状態とPDFエクスポートエラーを管理
 */

import { useState, useCallback } from 'react'

import { logger } from '@/lib/logger'

export interface UseErrorHandlingReturn {
  // State
  errorMessage: string | null
  pdfError: string | null
  
  // Actions
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>
  setPdfError: React.Dispatch<React.SetStateAction<string | null>>
  
  // Methods
  clearAllErrors: () => void
  handleError: (error: unknown, operation: string, context?: Record<string, any>) => void
  handlePdfError: (error: unknown) => void
}

export function useErrorHandling(): UseErrorHandlingReturn {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)

  // 全エラーをクリア
  const clearAllErrors = useCallback(() => {
    setErrorMessage(null)
    setPdfError(null)
  }, [])

  // 汎用エラーハンドラー
  const handleError = useCallback((
    error: unknown, 
    operation: string, 
    context: Record<string, any> = {}
  ) => {
    const errorMsg = error instanceof Error ? error.message : '予期しないエラーが発生しました'
    
    logger.error(`${operation} failed`, {
      operation,
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined,
      ...context
    })
    
    setErrorMessage(errorMsg)
  }, [])

  // PDFエクスポート専用エラーハンドラー
  const handlePdfError = useCallback((error: unknown) => {
    const errorMsg = error instanceof Error ? error.message : 'PDFの生成に失敗しました'
    
    logger.error('PDF export failed', {
      operation: 'handlePdfExport',
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined
    })
    
    setPdfError(errorMsg)
  }, [])

  return {
    // State
    errorMessage,
    pdfError,
    
    // Actions
    setErrorMessage,
    setPdfError,
    
    // Methods
    clearAllErrors,
    handleError,
    handlePdfError
  }
}