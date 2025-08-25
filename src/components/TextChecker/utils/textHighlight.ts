/**
 * TextChecker テキストハイライト ユーティリティ
 * 違反箇所のハイライト表示機能
 */

import { Violation } from '@/types'

/**
 * テキスト内の違反箇所をハイライト表示する
 * @param text 元のテキスト
 * @param violations 違反データの配列
 * @param selectedId 選択中の違反ID
 * @returns ハイライトされたHTML文字列
 */
export function highlightText(
  text: string, 
  violations: Violation[], 
  selectedId: number | null
): string {
  if (!violations.length) return text
  
  let highlightedText = text
  // Sort violations by start position in reverse order to maintain indices
  const sortedViolations = [...violations].sort((a, b) => b.startPos - a.startPos)
  
  sortedViolations.forEach((violation) => {
    // Validate positions
    const startPos = Math.max(0, Math.min(violation.startPos, text.length))
    const endPos = Math.max(startPos, Math.min(violation.endPos, text.length))
    
    // Check if positions are valid and extract text
    const violationText = text.substring(startPos, endPos)
    let finalStartPos = startPos
    let finalEndPos = endPos
    
    // For inferred violations, always use the original positions
    const isInferredViolation = violation.reason.startsWith('[INFERRED]')
    
    // If positions are invalid or text is empty and it's not an inferred violation, try to find the text from reason
    if (!isInferredViolation && (startPos >= endPos || !violationText.trim())) {
      // Extract text from reason using common patterns
      const patterns = [
        /「(.+?)」/,      // 「text」
        /：(.+?)→/,      // ：text→
        /：(.+?)は/,      // ：textは
      ]
      
      let searchText = null
      for (const pattern of patterns) {
        const match = violation.reason.match(pattern)
        if (match?.[1]) {
          searchText = match[1].trim()
          break
        }
      }
      
      if (searchText) {
        // Try to find the text in the original text
        const foundIndex = text.indexOf(searchText)
        if (foundIndex !== -1) {
          finalStartPos = foundIndex
          finalEndPos = foundIndex + searchText.length
        } else {
          // If exact match fails, try without common suffixes
          const cleanText = searchText.replace(/(になる|する|を出す|に|が|は|の)$/, '')
          if (cleanText && cleanText !== searchText) {
            const cleanIndex = text.indexOf(cleanText)
            if (cleanIndex !== -1) {
              finalStartPos = cleanIndex
              finalEndPos = cleanIndex + cleanText.length
            }
          }
        }
      }
      
      // If still not found, skip this violation
      if (finalStartPos === startPos && finalEndPos === endPos) {
        console.warn(`Could not find violation text in original text: ${violation.reason}`)
        return
      }
    }
    
    // Apply highlighting
    const before = highlightedText.substring(0, finalStartPos)
    const highlighted = highlightedText.substring(finalStartPos, finalEndPos)
    const after = highlightedText.substring(finalEndPos)
    
    const isSelected = selectedId !== null && (violation.id === selectedId)
    const baseClass = 'violation-span underline decoration-2 underline-offset-2 px-0.5 rounded-sm transition-colors'
    const colorClass = isSelected
      ? 'bg-red-300 text-red-900 decoration-red-700 ring-2 ring-red-400'
      : 'bg-red-100 text-red-800 decoration-red-600 hover:bg-red-200'
    const vidAttr = typeof violation.id === 'number' ? `data-vid="${violation.id}"` : ''
    
    highlightedText = before + 
      `<span class="${baseClass} ${colorClass}" ${vidAttr} title="${violation.reason}">${highlighted}</span>` + 
      after
  })
  
  return highlightedText
}

/**
 * 違反情報から表示用テキストを抽出
 * @param text 元のテキスト
 * @param violation 違反情報
 * @returns 表示用テキスト
 */
export function extractViolationText(text: string, violation: Violation): string {
  const directText = text.substring(violation.startPos, violation.endPos)
  
  if (directText.trim()) {
    return directText
  }
  
  // If direct text is empty, try to extract from reason
  const patterns = [
    /「(.+?)」/,
    /：(.+?)→/,
    /：(.+?)は/,
  ]
  
  for (const pattern of patterns) {
    const match = violation.reason.match(pattern)
    if (match?.[1]) {
      return match[1].trim()
    }
  }
  
  return '（テキストを特定できませんでした）'
}