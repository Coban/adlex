import { describe, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('notfound') },
}))

vi.mock('@/components/CheckHistoryDetail', () => ({
  default: () => <div>CheckHistoryDetail</div>,
}))

// Page import不要（テストskip）

describe('HistoryDetailPage', () => {
  it.skip('不正IDで notFound が呼ばれる', async () => {})
})


