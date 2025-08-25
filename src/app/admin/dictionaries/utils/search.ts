import { Dictionary } from '../types'

/**
 * 高度な検索クエリの解析・評価ユーティリティ
 */

interface TokenizedQuery {
  includeGroups: string[][] // AND of groups, OR within group (split by '|')
  excludes: string[]
}

/**
 * 高度な検索クエリをトークンに分解
 */
export function tokenizeAdvancedQuery(query: string): TokenizedQuery {
  const result: TokenizedQuery = {
    includeGroups: [],
    excludes: [],
  }

  if (!query.trim()) return result

  const lower = query.toLowerCase()

  // Extract quoted phrases
  const quoted: string[] = []
  const remainder = lower.replace(/"([^\"]+)"/g, (_m, p1) => {
    quoted.push(`"${p1.trim()}"`)
    return ' '
  })

  const rawTokens = [
    ...quoted,
    ...remainder
      .split(/\s+/)
      .map(t => t.trim())
      .filter(Boolean),
  ]

  for (const token of rawTokens) {
    if (!token) continue
    if (token.startsWith('-')) {
      const t = token.slice(1)
      if (t) result.excludes.push(t)
      continue
    }

    // OR grouping within a single space-separated token using '|'
    const group = token.split('|').map(t => t.trim()).filter(Boolean)
    if (group.length > 0) {
      result.includeGroups.push(group)
    }
  }

  return result
}

/**
 * フィールド値がトークンにマッチするかチェック
 */
function fieldMatch(value: string | null | undefined, token: string): boolean {
  if (!value) return false
  const v = value.toLowerCase()
  // Exact phrase: "..."
  if (token.startsWith('"') && token.endsWith('"')) {
    const phrase = token.slice(1, -1)
    return v.includes(phrase)
  }
  return v.includes(token)
}

/**
 * 辞書項目がトークンにマッチするかチェック
 */
function matchesToken(dict: Dictionary, token: string): boolean {
  // Field specific: phrase:xxx or notes:xxx
  if (token.startsWith('phrase:')) {
    return fieldMatch(dict.phrase, token.replace(/^phrase:/, ''))
  }
  if (token.startsWith('notes:')) {
    return fieldMatch(dict.notes ?? '', token.replace(/^notes:/, ''))
  }
  // Category specific: category:ng or category:allow (case-insensitive)
  if (token.startsWith('category:')) {
    const val = token.replace(/^category:/, '').toUpperCase()
    return dict.category.toUpperCase() === val
  }
  // Default: match in phrase or notes
  return fieldMatch(dict.phrase, token) || fieldMatch(dict.notes ?? '', token)
}

/**
 * 辞書項目が高度な検索クエリにマッチするかチェック
 */
export function matchesAdvancedQuery(dict: Dictionary, query: string): boolean {
  const { includeGroups, excludes } = tokenizeAdvancedQuery(query)

  // AND across groups: each group needs at least one token match
  for (const group of includeGroups) {
    let any = false
    for (const token of group) {
      if (matchesToken(dict, token)) {
        any = true
        break
      }
    }
    if (!any) return false
  }

  // Excludes: if any exclude token matches, reject
  for (const token of excludes) {
    if (matchesToken(dict, token)) return false
  }

  return true
}