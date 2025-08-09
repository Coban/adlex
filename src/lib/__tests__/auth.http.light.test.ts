import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// fetch を使う関数群を対象
import {
  inviteUser,
  fetchOrganizationUsers,
  updateUserRole,
  signUpWithInvitation,
  signInWithEmailAndPassword,
  signUpWithEmailAndPassword,
  inviteUserToOrganization,
} from '../auth'

describe('lib/auth http/light validations', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch as any
  })

  it('inviteUser: 空メールは即時エラー', async () => {
    await expect(inviteUser({ email: '  ', role: 'user' })).rejects.toThrow('メールアドレスを入力してください')
  })

  it('inviteUser: API 失敗はエラーメッセージを投げる', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ error: 'bad' }) })) as any
    await expect(inviteUser({ email: 'a@b.com', role: 'admin' })).rejects.toThrow('bad')
  })

  it('inviteUser: 成功はJSONを返す', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })) as any
    await expect(inviteUser({ email: 'a@b.com', role: 'user' })).resolves.toEqual({ ok: true })
  })

  it('fetchOrganizationUsers: 失敗はエラー', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ error: 'x' }) })) as any
    await expect(fetchOrganizationUsers()).rejects.toThrow('x')
  })

  it('fetchOrganizationUsers: 成功はJSON', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => (['u1']) })) as any
    await expect(fetchOrganizationUsers()).resolves.toEqual(['u1'])
  })

  it('updateUserRole: 失敗はエラー', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ error: 'ng' }) })) as any
    await expect(updateUserRole('uid', 'admin')).rejects.toThrow('ng')
  })

  it('updateUserRole: 成功はJSON', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'uid', role: 'user' }) })) as any
    await expect(updateUserRole('uid', 'user')).resolves.toEqual({ id: 'uid', role: 'user' })
  })

  it('signUpWithInvitation: パスワード不一致は即時エラー', async () => {
    await expect(signUpWithInvitation('t', 'abc123', 'zzz')).rejects.toThrow('パスワードが一致しません')
  })

  it('signUpWithInvitation: 短いパスワードは即時エラー', async () => {
    await expect(signUpWithInvitation('t', '123', '123')).rejects.toThrow('パスワードは6文字以上')
  })

  it('signUpWithInvitation: API 失敗はエラー', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ error: 'bad' }) })) as any
    await expect(signUpWithInvitation('token', '123456', '123456')).rejects.toThrow('bad')
  })

  it('signUpWithInvitation: 成功はJSON', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })) as any
    await expect(signUpWithInvitation('token', '123456', '123456')).resolves.toEqual({ ok: true })
  })

  it('signInWithEmailAndPassword: メール形式/パス長バリデーション', async () => {
    await expect(signInWithEmailAndPassword('badmail', '12345678')).rejects.toThrow('Invalid email format')
    await expect(signInWithEmailAndPassword('a@b.com', 'short')).rejects.toThrow('Password must be at least 8 characters')
  })

  it('signUpWithEmailAndPassword: メール形式/パス長バリデーション', async () => {
    await expect(signUpWithEmailAndPassword('badmail', '12345678')).rejects.toThrow('Invalid email format')
    await expect(signUpWithEmailAndPassword('a@b.com', 'short')).rejects.toThrow('Password must be at least 8 characters')
  })

  it('inviteUserToOrganization: メール形式チェック', async () => {
    await expect(inviteUserToOrganization('bad', 1, 'user' as any)).rejects.toThrow('Invalid email format')
  })
})


