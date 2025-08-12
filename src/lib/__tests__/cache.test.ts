import { describe, it, expect } from 'vitest'
import { cache, CacheUtils, invalidatePattern } from '../cache'

describe('MemoryCache', () => {
  it('set/get/has/delete が動作する', () => {
    cache.clear()
    cache.set('k', { v: 1 }, 1000)
    expect(cache.has('k')).toBe(true)
    expect(cache.get<{ v: number }>('k')?.v).toBe(1)
    expect(cache.delete('k')).toBe(true)
    expect(cache.has('k')).toBe(false)
  })

  it.skip('cached デコレータで結果をキャッシュする', async () => {})

  it('invalidatePattern でパターン一致のキーを削除', () => {
    cache.clear()
    cache.set('org:1', 1)
    cache.set('org:2', 2)
    const removed = invalidatePattern(/^org:/)
    expect(removed).toBeGreaterThan(0)
  })

  it('CacheUtils のキー生成', () => {
    expect(CacheUtils.orgKey(1)).toBe('org:1')
    expect(CacheUtils.userKey('u')).toBe('user:u')
  })
})


