import { describe, it, expect, vi, beforeEach } from 'vitest'

const fromMock = {
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      single: vi.fn(async () => ({ data: { id: 'u' }, error: null })),
      maybeSingle: vi.fn(async () => ({ data: { id: 'u' }, error: null })),
    })),
  })),
  update: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'u' }, error: null })) })) })),
  insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 1 }, error: null })) })) })),
  upsert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'u' }, error: null })) })) })),
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(async () => ({ data: { user: { id: 'u' } }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: { id: 'u' } }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn(() => fromMock),
  })),
}))

// target
import {
  getCurrentUser,
  getUserProfile,
  createUserProfile,
  updateUserProfile,
  checkUserExists,
  createOrganization,
  changeUserRole,
} from '../auth'

describe('lib/auth extra light tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getCurrentUser: ユーザーを返す', async () => {
    const u = await getCurrentUser()
    expect(u).toEqual({ id: 'u' })
  })

  it('getUserProfile: プロファイル取得', async () => {
    const p = await getUserProfile('u')
    expect(p).toEqual({ id: 'u' })
  })

  it('createUserProfile: 必須バリデーション', async () => {
    // id なし
    // @ts-expect-error test invalid
    await expect(createUserProfile({ email: 'a@b.com' })).rejects.toThrow('User ID is required')
    // email なし
    // @ts-expect-error test invalid
    await expect(createUserProfile({ id: 'u' })).rejects.toThrow('Email is required')
  })

  it('updateUserProfile: userId 必須', async () => {
    // @ts-expect-error test invalid
    await expect(updateUserProfile('', { role: 'user' } as any)).rejects.toThrow('User ID is required')
  })

  it('checkUserExists: boolean を返す', async () => {
    const exists = await checkUserExists('a@b.com')
    expect(exists).toBe(true)
  })

  it('createOrganization: name 必須', async () => {
    // @ts-expect-error test invalid
    await expect(createOrganization('', 'free' as any)).rejects.toThrow('Organization name is required')
  })

  it('changeUserRole: role バリデーション', async () => {
    // @ts-expect-error test invalid
    await expect(changeUserRole('u', 'owner' as any)).rejects.toThrow('Invalid role')
  })
})


