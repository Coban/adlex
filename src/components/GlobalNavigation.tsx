'use client'

import { 
  Home, 
  FileText, 
  Users, 
  Book,
  Bug,
  LogIn,
  UserPlus,
  Clock,
  LogOut,
  Menu,
  X
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

interface NavigationItem {
  name: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
  requireAuth?: boolean
  requireRole?: 'admin' | 'user'
  showInMobile?: boolean
}

const navigationItems: NavigationItem[] = [
  {
    name: 'ホーム',
    href: '/',
    icon: Home,
    showInMobile: true
  },
  {
    name: 'テキストチェック',
    href: '/checker',
    icon: FileText,
    requireAuth: true,
    showInMobile: true
  },
  {
    name: 'チェック履歴',
    href: '/history',
    icon: Clock,
    requireAuth: true,
    showInMobile: true
  },
  {
    name: 'ユーザー管理',
    href: '/admin/users',
    icon: Users,
    requireAuth: true,
    requireRole: 'admin',
    showInMobile: true
  },
  {
    name: '辞書管理',
    href: '/dictionaries',
    icon: Book,
    requireAuth: true,
    requireRole: 'admin',
    showInMobile: true
  },
  {
    name: 'デバッグ',
    href: '/debug/auth',
    icon: Bug,
    showInMobile: false
  }
]

export default function GlobalNavigation() {
  const { user, userProfile, organization, loading, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch by waiting for client-side mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  const shouldShowItem = (item: NavigationItem) => {
    // During initial mount, show all non-auth items
    if (!mounted) {
      return !item.requireAuth
    }
    if (item.requireAuth && !user) return false
    if (item.requireRole && userProfile?.role !== item.requireRole) return false
    return true
  }

  const visibleItems = navigationItems.filter(shouldShowItem)
  const mobileVisibleItems = visibleItems.filter(item => item.showInMobile !== false)

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* ロゴとメインナビゲーション */}
          <div className="flex items-center space-x-8">
            {/* ロゴ */}
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">AdLex</span>
            </Link>

            {/* デスクトップナビゲーション */}
            <div className="hidden md:flex items-center space-x-4" data-testid="desktop-nav">
              {visibleItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    data-testid={
                      item.href === '/' ? 'nav-home' :
                      item.href === '/checker' ? 'nav-checker' :
                      item.href === '/history' ? 'nav-history' :
                      item.href === '/admin/users' ? 'nav-admin' : 
                      item.href === '/dictionaries' ? 'nav-dictionaries' : 
                      undefined
                    }
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* 右側のユーザー情報とメニュー */}
          <div className="flex items-center space-x-4">
            {/* ローディング中の表示 */}
            {(!mounted || loading) && (
              <div className="text-sm text-gray-500">読み込み中...</div>
            )}

            {/* 認証済みユーザーの表示 */}
            {mounted && !loading && user && (
              <div className="hidden md:flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{user.email}</div>
                  {organization && userProfile && (
                    <span className="text-sm text-gray-600">
                      {userProfile.role === 'admin' ? '管理者' : 'ユーザー'} | {organization.name}
                    </span>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={async () => {
                    try {
                      await signOut()
                      router.replace('/auth/signin')
                    } catch (error) {
                      console.error('GlobalNavigation: SignOut failed:', error)
                      alert('サインアウトに失敗しました。もう一度お試しください。')
                    }
                  }}
                  className="flex items-center space-x-2"
                  data-testid="nav-signout"
                >
                  <LogOut className="w-4 h-4" />
                  <span>サインアウト</span>
                </Button>
              </div>
            )}

            {/* 未認証ユーザーの表示 */}
            {mounted && !loading && !user && (
              <div className="hidden md:flex items-center space-x-2">
                <Link href="/auth/signin">
                  <Button variant="outline" size="sm" className="flex items-center space-x-2" data-testid="nav-signin">
                    <LogIn className="w-4 h-4" />
                    <span>サインイン</span>
                  </Button>
                </Link>
                <Link href="/auth/signup">
                  <Button size="sm" className="flex items-center space-x-2" data-testid="nav-signup">
                    <UserPlus className="w-4 h-4" />
                    <span>サインアップ</span>
                  </Button>
                </Link>
              </div>
            )}

            {/* モバイルメニューボタン */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2"
                data-testid="mobile-menu-toggle"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* モバイルメニュー */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200" data-testid="mobile-menu">
            <div className="space-y-2">
              {mobileVisibleItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    data-testid={
                      item.href === '/' ? 'nav-home' :
                      item.href === '/checker' ? 'nav-checker' :
                      item.href === '/history' ? 'nav-history' :
                      item.href === '/admin/users' ? 'nav-admin' : 
                      item.href === '/dictionaries' ? 'nav-dictionaries' : 
                      undefined
                    }
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </div>

            {/* モバイル版ユーザー情報 */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              {!loading && user && (
                <div className="space-y-3">
                  <div className="px-3">
                    <div className="text-sm font-medium text-gray-900">{user.email}</div>
                    {organization && userProfile && (
                      <div className="text-sm text-gray-600">
                        {userProfile.role === 'admin' ? '管理者' : 'ユーザー'} | {organization.name}
                      </div>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={async () => {
                      setMobileMenuOpen(false)
                      try {
                        await signOut()
                        await new Promise((r) => setTimeout(r, 50))
                        router.replace('/auth/signin')
                      } catch (error) {
                        console.error('GlobalNavigation Mobile: SignOut failed:', error)
                        alert('サインアウトに失敗しました。もう一度お試しください。')
                      }
                    }}
                    className="w-full flex items-center justify-center space-x-2"
                    data-testid="nav-signout"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>サインアウト</span>
                  </Button>
                </div>
              )}

              {!loading && !user && (
                <div className="space-y-2">
                  <Link href="/auth/signin" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full flex items-center justify-center space-x-2" data-testid="nav-signin">
                      <LogIn className="w-4 h-4" />
                      <span>サインイン</span>
                    </Button>
                  </Link>
                  <Link href="/auth/signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button size="sm" className="w-full flex items-center justify-center space-x-2" data-testid="nav-signup">
                      <UserPlus className="w-4 h-4" />
                      <span>サインアップ</span>
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
