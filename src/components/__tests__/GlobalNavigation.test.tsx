import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/link', () => ({ default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a> }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, userProfile: null, organization: null, loading: false, signOut: vi.fn() }),
}))

import GlobalNavigation from '../GlobalNavigation'

describe('GlobalNavigation', () => {
  it('未認証時にサインイン/サインアップが表示される', () => {
    render(<GlobalNavigation />)
    expect(screen.getByTestId('nav-signin')).toBeInTheDocument()
    expect(screen.getByTestId('nav-signup')).toBeInTheDocument()
  })

  it('モバイルメニューの開閉ができる', () => {
    render(<GlobalNavigation />)
    const toggle = screen.getByTestId('mobile-menu-toggle')
    fireEvent.click(toggle)
    expect(screen.getByTestId('mobile-menu')).toBeInTheDocument()
  })
})


