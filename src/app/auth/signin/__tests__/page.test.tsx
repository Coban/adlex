import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}))

vi.mock('@/lib/auth', () => ({
  signIn: vi.fn(async () => ({ user: null })),
}))

import Page from '../page'

describe('SignInPage', () => {
  it('見出しが描画される', () => {
    render(<Page />)
    expect(screen.getAllByText('サインイン').length).toBeGreaterThan(0)
  })
})


