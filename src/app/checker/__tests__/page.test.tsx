import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/link', () => ({ default: ({ children }: any) => <a>{children}</a> }))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}))

vi.mock('@/components/TextChecker', () => ({
  default: () => <div>TextChecker</div>,
}))

import Page from '../page'

describe('CheckerPage', () => {
  it('未認証時のプレースホルダーが表示される', () => {
    render(<Page />)
    expect(screen.getByText('薬機法チェック & リライト')).toBeInTheDocument()
  })
})


