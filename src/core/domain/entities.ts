/**
 * エンティティのベースクラス
 */
export abstract class Entity<TId> {
  protected constructor(public readonly id: TId) {}

  equals(other: Entity<TId>): boolean {
    return this.id === other.id
  }
}

/**
 * 組織エンティティ
 */
export class Organization extends Entity<number> {
  constructor(
    id: number,
    public readonly name: string,
    public readonly subscription: 'trial' | 'basic' | 'premium' | 'enterprise',
    public readonly limits: OrganizationLimits,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {
    super(id)
  }

  isWithinLimits(usage: OrganizationUsage): boolean {
    return (
      usage.monthlyChecks <= this.limits.monthlyChecks &&
      usage.totalUsers <= this.limits.totalUsers &&
      usage.totalDictionaries <= this.limits.totalDictionaries
    )
  }

  canInviteUser(currentUserCount: number): boolean {
    return currentUserCount < this.limits.totalUsers
  }
}

/**
 * ユーザーエンティティ
 */
export class User extends Entity<string> {
  constructor(
    id: string,
    public readonly email: string,
    public readonly role: UserRole,
    public readonly organizationId: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {
    super(id)
  }

  isAdmin(): boolean {
    return this.role === 'admin'
  }

  canManageUsers(): boolean {
    return this.role === 'admin'
  }

  canManageDictionaries(): boolean {
    return this.role === 'admin'
  }
}

/**
 * 辞書項目エンティティ
 */
export class DictionaryItem extends Entity<number> {
  constructor(
    id: number,
    public readonly phrase: string,
    public readonly category: DictionaryCategory,
    public readonly organizationId: number,
    public readonly vector: number[] | null,
    public readonly notes: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {
    super(id)
  }

  hasEmbedding(): boolean {
    return this.vector !== null && this.vector.length > 0
  }

  isNGPhrase(): boolean {
    return this.category === 'NG'
  }

  isAllowPhrase(): boolean {
    return this.category === 'ALLOW'
  }
}

/**
 * チェックエンティティ
 */
export class Check extends Entity<number> {
  constructor(
    id: number,
    public readonly userId: string,
    public readonly organizationId: number,
    public readonly inputText: string,
    public readonly extractedText: string | null,
    public readonly status: CheckStatus,
    public readonly violationCount: number,
    public readonly createdAt: Date,
    public readonly completedAt: Date | null
  ) {
    super(id)
  }

  isCompleted(): boolean {
    return this.status === 'completed'
  }

  isPending(): boolean {
    return this.status === 'pending'
  }

  isFailed(): boolean {
    return this.status === 'failed'
  }

  hasViolations(): boolean {
    return this.violationCount > 0
  }
}

/**
 * 違反項目エンティティ
 */
export class Violation extends Entity<number> {
  constructor(
    id: number,
    public readonly checkId: number,
    public readonly dictionaryId: number | null,
    public readonly originalText: string,
    public readonly suggestedText: string | null,
    public readonly reasoning: string | null,
    public readonly startPosition: number,
    public readonly endPosition: number,
    public readonly createdAt: Date
  ) {
    super(id)
  }

  hasLocation(): boolean {
    return this.startPosition >= 0 && this.endPosition > this.startPosition
  }

  hasSuggestion(): boolean {
    return this.suggestedText !== null && this.suggestedText.length > 0
  }

  hasReasoning(): boolean {
    return this.reasoning !== null && this.reasoning.length > 0
  }
}

// Value Objects and Types
export type UserRole = 'admin' | 'user'
export type DictionaryCategory = 'NG' | 'ALLOW'
export type CheckStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
export type SubscriptionTier = 'trial' | 'basic' | 'premium' | 'enterprise'

export interface OrganizationLimits {
  monthlyChecks: number
  totalUsers: number
  totalDictionaries: number
  storageGB: number
}

export interface OrganizationUsage {
  monthlyChecks: number
  totalUsers: number
  totalDictionaries: number
  storageUsedGB: number
}