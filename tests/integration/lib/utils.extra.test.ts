import { describe, it, expect } from 'vitest'
import { truncateText, formatDate, cn } from '@/lib/utils'

describe('utils extra', () => {
  it('truncateText: 指定長以下ならそのまま', () => {
    expect(truncateText('abc', 5)).toBe('abc')
  })

  it('truncateText: 指定長を超えると省略', () => {
    expect(truncateText('abcdef', 3)).toBe('abc...')
  })

  it('formatDate: 日付をフォーマットする', () => {
    const s = formatDate('2024-01-02T03:04:00Z')
    expect(s).toMatch(/2024/) // ざっくり
  })

  it('cn: クラスをマージする', () => {
    const merged = cn('a', false && 'b', 'c')
    expect(merged).toContain('a')
    expect(merged).toContain('c')
  })
})


