import { render, screen } from '@testing-library/react'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, it, expect, vi } from 'vitest'

// Mock next/font to return stable class names
vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: 'font-geist' }),
  Geist_Mono: () => ({ variable: 'font-mono' })
}))

// Mock AuthContext to avoid Supabase calls inside AuthProvider
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (children as React.ReactElement),
  useAuth: vi.fn(() => ({
    user: null,
    userProfile: null,
    organization: null,
    loading: false,
    signOut: vi.fn(),
    refresh: vi.fn()
  }))
}))

// Mock GlobalNavigation to avoid next/navigation dependencies
vi.mock('@/components/GlobalNavigation', () => ({
  default: () => <nav data-testid="global-navigation">GlobalNav</nav>
}))

// Mock MSWInit to avoid side effects in tests
vi.mock('@/components/MSWInit', () => ({
  default: () => null
}))

import RootLayout, { metadata } from '@/app/layout'

describe('RootLayout', () => {
  it('metadata が期待通りであること', () => {
    expect(metadata.title).toBe('AdLex')
    expect(metadata.description).toBe('AI-powered text checking platform')
  })

  it('<html lang="ja"> と <body> のクラスが設定され、子要素が <main> に描画されること', () => {
    const html = renderToString(
      <RootLayout>
        <div>Child Content</div>
      </RootLayout>
    )

    expect(html).toContain('<html lang="ja"')
    expect(html).toContain('class=')
    expect(html).toContain('antialiased')
    expect(html).toContain('font-geist')
    expect(html).toContain('font-mono')
    expect(html).toContain('<main>')
    expect(html).toContain('Child Content')
  })

  it('GlobalNavigation が描画されること', () => {
    render(
      <RootLayout>
        <div />
      </RootLayout>
    )
    expect(screen.getByTestId('global-navigation')).toBeInTheDocument()
  })
})


