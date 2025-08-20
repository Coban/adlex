import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  signUpWithOrganization: vi.fn(async () => ({})),
}))

import Page from '@/app/auth/organization-signup/page'

describe('OrganizationSignUpPage', () => {
  it('見出しが描画される', () => {
    render(<Page />)
    expect(screen.getAllByText('組織アカウント作成').length).toBeGreaterThan(0)
  })
})


