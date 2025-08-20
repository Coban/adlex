import { vi } from 'vitest'

import { FindManyOptions } from '@/lib/repositories/interfaces/base'
import { User, UserInsert, UserUpdate, UserRole, UserWithOrganization, UsersRepository } from '@/lib/repositories/interfaces/users'

/**
 * Mock implementation of UsersRepository for testing
 */
export class MockUsersRepository implements UsersRepository {
  // Mock data storage
  private users: User[] = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@test.com',
      role: 'admin',
      organization_id: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'user@test.com',
      role: 'user',
      organization_id: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ]

  private usersWithOrg: UserWithOrganization[] = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@test.com',
      role: 'admin',
      organization_id: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      organizations: {
        id: 1,
        name: 'Test Organization',
        plan: 'trial',
        max_checks: 1000,
        used_checks: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        icon_url: null,
        logo_url: null,
        trial_ends_at: null,
      },
    },
  ]

  // Spy on methods for testing
  findById = vi.fn(async (id: string): Promise<User | null> => {
    return this.users.find(user => user.id === id) ?? null
  })

  findMany = vi.fn(async (options?: FindManyOptions<User>): Promise<User[]> => {
    let result = [...this.users]

    if (options?.where) {
      result = result.filter(user => {
        return Object.entries(options.where!).every(([key, value]) => {
          return user[key as keyof User] === value
        })
      })
    }

    if (options?.limit) {
      result = result.slice(0, options.limit)
    }

    return result
  })

  create = vi.fn(async (data: UserInsert): Promise<User> => {
    const newUser: User = {
      id: data.id,
      email: data.email ?? null,
      role: data.role ?? 'user',
      organization_id: data.organization_id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    this.users.push(newUser)
    return newUser
  })

  update = vi.fn(async (id: string, data: UserUpdate): Promise<User | null> => {
    const userIndex = this.users.findIndex(user => user.id === id)
    if (userIndex === -1) return null

    this.users[userIndex] = {
      ...this.users[userIndex],
      ...data,
      updated_at: new Date().toISOString(),
    }
    return this.users[userIndex]
  })

  delete = vi.fn(async (id: string): Promise<boolean> => {
    const initialLength = this.users.length
    this.users = this.users.filter(user => user.id !== id)
    return this.users.length < initialLength
  })

  count = vi.fn(async (filter?: Partial<User>): Promise<number> => {
    if (!filter) return this.users.length

    return this.users.filter(user => {
      return Object.entries(filter).every(([key, value]) => {
        return user[key as keyof User] === value
      })
    }).length
  })

  findByIdWithOrganization = vi.fn(async (id: string): Promise<UserWithOrganization | null> => {
    return this.usersWithOrg.find(user => user.id === id) ?? null
  })

  findByOrganizationId = vi.fn(async (organizationId: number, options?: FindManyOptions<User>): Promise<User[]> => {
    return this.findMany({ ...options, where: { ...options?.where, organization_id: organizationId } })
  })

  findByRole = vi.fn(async (role: UserRole, options?: FindManyOptions<User>): Promise<User[]> => {
    return this.findMany({ ...options, where: { ...options?.where, role } })
  })

  findAdmins = vi.fn(async (options?: FindManyOptions<User>): Promise<User[]> => {
    return this.findByRole('admin', options)
  })

  updateRole = vi.fn(async (id: string, role: UserRole): Promise<User | null> => {
    return this.update(id, { role })
  })

  isAdmin = vi.fn(async (id: string): Promise<boolean> => {
    const user = await this.findById(id)
    return user?.role === 'admin'
  })

  findByEmail = vi.fn(async (email: string): Promise<User | null> => {
    return this.users.find(user => user.email === email) ?? null
  })

  // Helper methods for test setup
  setMockUsers(users: User[]) {
    this.users = [...users]
  }

  setMockUsersWithOrg(users: UserWithOrganization[]) {
    this.usersWithOrg = [...users]
  }

  reset() {
    vi.clearAllMocks()
    this.users = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@test.com',
        role: 'admin',
        organization_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        email: 'user@test.com',
        role: 'user',
        organization_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]
  }
}