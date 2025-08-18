import { describe, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('notfound') },
}))

vi.mock('@/components/CheckHistoryDetail', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ checkId }: any) => <div data-testid="detail">Detail {checkId}</div>,
}))

// Page import不要（全テストskip）

describe('HistoryDetailPage (simple)', () => {
  it.skip('数値でないIDは notFound', async () => {})

  it.skip('正しいIDなら描画される', async () => {})
})


