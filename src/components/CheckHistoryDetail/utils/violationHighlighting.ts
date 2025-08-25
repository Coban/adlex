import { Violation } from '../types'

/**
 * 違反箇所のハイライト表示ユーティリティ
 */

/**
 * 違反位置を修正する（不正な位置の場合に文字列から検索）
 */
function adjustViolationPosition(
  text: string,
  violation: Violation
): { startPos: number; endPos: number } {
  let startPos = Math.max(0, Math.min(violation.startPos, text.length))
  let endPos = Math.max(startPos, Math.min(violation.endPos, text.length))
  
  // If positions are invalid, try to find the text by searching
  if (startPos >= endPos) {
    const reasonMatch = violation.reason.match(/「(.+?)」/)
    if (reasonMatch) {
      const searchText = reasonMatch[1]
      const foundIndex = text.indexOf(searchText)
      if (foundIndex !== -1) {
        startPos = foundIndex
        endPos = foundIndex + searchText.length
      } else {
        console.warn(`Could not find violation text "${searchText}" in original text`)
        return { startPos: violation.startPos, endPos: violation.endPos }
      }
    } else {
      console.warn(`Invalid violation position: ${violation.startPos}-${violation.endPos} for text length ${text.length}`)
      return { startPos: violation.startPos, endPos: violation.endPos }
    }
  }
  
  // Additional validation: extract the actual text and check if it makes sense
  const actualText = text.substring(startPos, endPos)
  
  // If the extracted text doesn't seem to match the violation reason, 
  // try to find the correct text using fuzzy matching
  if (actualText.length > 0) {
    // Try to extract the key term from the reason
    const reasonParts = violation.reason.split('：')
    if (reasonParts.length > 1) {
      const beforeAfter = reasonParts[1].split('→')
      if (beforeAfter.length > 1) {
        const targetTerm = beforeAfter[0].trim()
        
        // Check if the actual text contains the target term
        if (!actualText.includes(targetTerm)) {
          // Try to find the target term in the text
          const termIndex = text.indexOf(targetTerm)
          if (termIndex !== -1) {
            startPos = termIndex
            endPos = termIndex + targetTerm.length
          } else {
            // If exact match fails, try partial matching
            const words = targetTerm.split(/\s+/)
            for (const word of words) {
              if (word.length > 1) {
                const wordIndex = text.indexOf(word)
                if (wordIndex !== -1) {
                  startPos = wordIndex
                  endPos = wordIndex + word.length
                  break
                }
              }
            }
          }
        }
      }
    }
  }
  
  return { startPos, endPos }
}

/**
 * 違反箇所をHTMLでハイライト表示する
 */
export function highlightViolations(
  text: string, 
  violations: Violation[], 
  showViolations: boolean
): string {
  if (!showViolations || violations.length === 0) {
    return text
  }

  // Sort violations by start position in descending order to avoid position shifts
  const sortedViolations = [...violations].sort((a, b) => b.startPos - a.startPos)
  
  let highlightedText = text
  sortedViolations.forEach((violation) => {
    const { startPos, endPos } = adjustViolationPosition(highlightedText, violation)
    
    // Final validation
    if (startPos >= endPos || startPos < 0 || endPos > highlightedText.length) {
      console.warn(`Skipping invalid violation position: ${startPos}-${endPos} for text length ${highlightedText.length}`)
      return
    }
    
    const before = highlightedText.substring(0, startPos)
    const violationText = highlightedText.substring(startPos, endPos)
    const after = highlightedText.substring(endPos)
    
    highlightedText = before + 
      `<span class="bg-red-100 text-red-800 px-1 rounded relative" title="${violation.reason}">` +
      violationText +
      '</span>' +
      after
  })

  return highlightedText
}

/**
 * 違反箇所のテキストを抽出する（表示用）
 */
export function extractViolationText(text: string, violation: Violation): string {
  const { startPos, endPos } = adjustViolationPosition(text, violation)
  
  // Final validation
  if (startPos >= endPos || startPos < 0 || endPos > text.length) {
    return '(位置が無効)'
  }
  
  return text.substring(startPos, endPos)
}