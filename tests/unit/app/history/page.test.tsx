import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/components/CheckHistoryList', () => ({
  default: () => <div>CheckHistoryList</div>,
}))

import Page from '@/app/history/page'

describe('HistoryPage', () => {
  it('見出しが表示される', () => {
    render(<Page />)
    expect(screen.getByText('チェック履歴')).toBeInTheDocument()
  })
})


