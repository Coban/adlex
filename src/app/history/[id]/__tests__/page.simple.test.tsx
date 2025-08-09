import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('notfound') },
}))

vi.mock('@/components/CheckHistoryDetail', () => ({
  default: ({ checkId }: any) => <div data-testid="detail">Detail {checkId}</div>,
}))

import Page from '../page'

describe('HistoryDetailPage (simple)', () => {
  it.skip('数値でないIDは notFound', async () => {})

  it.skip('正しいIDなら描画される', async () => {})
})


