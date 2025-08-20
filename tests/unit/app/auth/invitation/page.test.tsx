import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/auth', () => ({
  signUpWithInvitation: vi.fn(async () => ({})),
}))

import Page from '@/app/auth/invitation/page'

describe('InvitationPage', () => {
  it('トークンなしの簡易表示', () => {
    render(<Page />)
    expect(screen.getByText('招待リンクが無効です。')).toBeInTheDocument()
  })
})


