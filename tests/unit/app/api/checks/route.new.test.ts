import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted mocks to avoid initialization order issues
const { addToQueueMock } = vi.hoisted(() => ({
  addToQueueMock: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/queue-manager', () => ({
  queueManager: { addToQueue: addToQueueMock },
}))

// Supabase server client mock (async factory in implementation)
type SupabaseMock = {
  auth: { getUser: ReturnType<typeof vi.fn> }
  from: ReturnType<typeof vi.fn>
}

const { supabaseMock } = vi.hoisted(() => {
  const mock: SupabaseMock = {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  }
  return { supabaseMock: mock }
})

vi.mock('@/infra/supabase/serverClient', () => ({
  createClient: vi.fn(async () => supabaseMock),
}))

// Import target after mocks are set up
import { POST } from '@/app/api/checks/route'

describe.skip('Checks API Route (current implementation)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // default: authenticated user
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  const mockUsersSelect = (overrides?: {
    used_checks?: number
    max_checks?: number
    organization_id?: number
  }) => {
    const userRow = {
      id: 'user-123',
      role: 'user',
      organization_id: overrides?.organization_id ?? 1,
      // organizations join payload the route expects
      organizations: {
        id: overrides?.organization_id ?? 1,
        name: 'Org',
        used_checks: overrides?.used_checks ?? 0,
        max_checks: overrides?.max_checks ?? 100,
      },
    }

    supabaseMock.from.mockImplementationOnce((table: string) => {
      expect(table).toBe('users')
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: userRow, error: null })),
          })),
        })),
      } as unknown as ReturnType<typeof supabaseMock.from>
    })
  }

  const mockChecksInsert = (ok: boolean) => {
    supabaseMock.from.mockImplementationOnce((table: string) => {
      expect(table).toBe('checks')
      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve(
                ok
                  ? { data: { id: 101 }, error: null }
                  : { data: null, error: new Error('insert error') },
              ),
            ),
          })),
        })),
      } as unknown as ReturnType<typeof supabaseMock.from>
    })
  }

  it('should create a new text check and enqueue', async () => {
    mockUsersSelect()
    mockChecksInsert(true)

    const request = new NextRequest('http://localhost:3000/api/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '安全なテキスト' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ id: 101, status: 'pending' })
    expect(addToQueueMock).toHaveBeenCalledWith(101, '安全なテキスト', 1, 'normal', 'text', undefined)
  })

  it('should create a new image check and enqueue', async () => {
    mockUsersSelect()
    mockChecksInsert(true)

    const request = new NextRequest('http://localhost:3000/api/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_type: 'image', image_url: 'https://example.com/a.png' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ id: 101, status: 'pending' })
    expect(addToQueueMock).toHaveBeenCalledWith(101, '', 1, 'normal', 'image', 'https://example.com/a.png')
  })

  it('should return 400 when text is missing', async () => {
    mockUsersSelect()
    const request = new NextRequest('http://localhost:3000/api/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error', 'Text is required')
  })

  it('should return 400 when text is empty', async () => {
    mockUsersSelect()
    const request = new NextRequest('http://localhost:3000/api/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '   ' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error', 'Text cannot be empty')
  })

  it('should return 400 when text exceeds length limit', async () => {
    mockUsersSelect()
    const longText = 'a'.repeat(10001)
    const request = new NextRequest('http://localhost:3000/api/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: longText }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error', 'Text too long (max 10000 characters)')
  })

  it('should return 400 when image_url is missing for image input', async () => {
    mockUsersSelect()
    const request = new NextRequest('http://localhost:3000/api/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_type: 'image' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error', 'image_url is required for image checks')
  })

  it('should return 429 when usage limit exceeded', async () => {
    mockUsersSelect({ used_checks: 100, max_checks: 100 })
    const request = new NextRequest('http://localhost:3000/api/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'テキスト' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data).toHaveProperty('error', 'Monthly usage limit exceeded')
    expect(data).toHaveProperty('usage', 100)
    expect(data).toHaveProperty('limit', 100)
  })

  it('should return 500 when DB insertion fails', async () => {
    mockUsersSelect()
    mockChecksInsert(false)

    const request = new NextRequest('http://localhost:3000/api/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'テキスト' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toHaveProperty('error', 'Failed to create check')
  })

  it('should return 401 when unauthorized (no user and no token)', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    const request = new NextRequest('http://localhost:3000/api/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'テキスト' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toHaveProperty('error', 'Unauthorized')
  })

  it('should return 500 on invalid JSON body', async () => {
    mockUsersSelect()
    const request = new NextRequest('http://localhost:3000/api/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Intentionally invalid JSON string to trigger parse error
      body: 'invalid json' as unknown as BodyInit,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toHaveProperty('error', 'Internal server error')
  })
})


