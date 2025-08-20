import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  signUp: vi.fn(async () => ({})),
}))

import Page from '@/app/auth/signup/page'

describe('SignUpPage', () => {
  it('見出しが描画される', () => {
    render(<Page />)
    expect(screen.getByText('サインアップ')).toBeInTheDocument()
  })
})


