import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('notfound') },
}))

vi.mock('@/components/CheckHistoryDetail', () => ({
  default: () => <div>CheckHistoryDetail</div>,
}))

import Page from '../page'

describe('HistoryDetailPage', () => {
  it.skip('不正IDで notFound が呼ばれる', async () => {})
})


