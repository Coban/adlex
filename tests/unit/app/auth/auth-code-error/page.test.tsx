import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import Page from '@/app/auth/auth-code-error/page'

describe('AuthCodeErrorPage', () => {
  it('認証エラー画面が表示される', () => {
    render(<Page />)
    expect(screen.getByText('認証エラー')).toBeInTheDocument()
    expect(screen.getByText('サインアップページに戻る')).toBeInTheDocument()
  })
})


