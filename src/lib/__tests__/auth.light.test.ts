import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signUp: vi.fn(async ({ email, password }: any) => {
        if (!email.includes('@')) return { data: null, error: { message: 'Invalid email' } }
        if (password.length < 6) return { data: null, error: { message: 'Password should be' } }
        return { data: { user: { id: 'u' } }, error: null }
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signInWithPassword: vi.fn(async ({ email }: any) => {
        if (email === 'bad@example.com') return { data: null, error: { message: 'Invalid login credentials' } }
        return { data: { user: { id: 'u' } }, error: null }
      }),
      signOut: vi.fn(async () => ({ error: null })),
      getUser: vi.fn(async () => ({ data: { user: { id: 'u' } }, error: null })),
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: () => ({ data: { id: 'u' }, error: null }),
          maybeSingle: () => ({ data: { id: 'u' }, error: null }),
        }),
      }),
      update: () => ({ eq: () => ({ single: () => ({ data: { id: 'u' }, error: null }) }) }),
      insert: () => ({ select: () => ({ single: () => ({ data: { id: 1 }, error: null }) }) }),
      upsert: () => ({ select: () => ({ single: () => ({ data: { id: 'u' }, error: null }) }) }),
    })),
  }))
}))

// Import targets after mock
import { signUp, signIn, signOut } from '../auth'

describe('lib/auth light validations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('signUp: パスワード不一致は即時エラー', async () => {
    await expect(signUp({ email: 'a@b.com', password: '123456', confirmPassword: '123' })).rejects.toThrow('パスワードが一致しません')
  })

  it('signUp: 短すぎるパスワードはエラー', async () => {
    await expect(signUp({ email: 'a@b.com', password: '123', confirmPassword: '123' })).rejects.toThrow('パスワードは6文字以上')
  })

  it('signIn: 誤った資格情報はエラー文言に変換', async () => {
    await expect(signIn({ email: 'bad@example.com', password: 'xxxxxx' })).rejects.toThrow('メールアドレスまたはパスワードが正しくありません')
  })

  it('signOut: 成功で例外なし', async () => {
    await expect(signOut()).resolves.toBeUndefined()
  })
})


