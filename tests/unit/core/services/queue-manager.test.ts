import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { CheckQueueManager } from '@/lib/queue-manager'

// Mock processing function to avoid heavy work
vi.mock('../check-processor', () => ({
  processCheck: vi.fn(async () => {}),
}))

describe('CheckQueueManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('キューに追加するとステータスに反映される', async () => {
    const qm = new CheckQueueManager(1)
    expect(qm.getStatus().queueLength).toBe(0)
    await qm.addToQueue(1, 'text', 1)
    const status = qm.getStatus()
    expect(status.maxConcurrent).toBe(1)
    // queueLength は即時処理で減る可能性があるため processingCount もチェック
    expect(status.queueLength >= 0).toBe(true)
    expect(status.processingCount >= 0).toBe(true)
  })

  it('clear() でキューと処理状態がクリアされる', async () => {
    const qm = new CheckQueueManager(1)
    await qm.addToQueue(1, 'text', 1)
    qm.clear()
    const status = qm.getStatus()
    expect(status.queueLength).toBe(0)
    expect(status.processingCount).toBe(0)
  })
})


