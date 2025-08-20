import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}))

vi.mock('@/components/ImageChecker', () => ({
  default: () => <div>ImageChecker</div>,
}))

import Page from '@/app/checker/image/page'

describe('ImageCheckerPage', () => {
  it('未認証時の案内が表示される', () => {
    render(<Page />)
    expect(screen.getByText('画像から薬機法チェック')).toBeInTheDocument()
  })
})


