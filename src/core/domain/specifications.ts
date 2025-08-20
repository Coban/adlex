import { Organization, OrganizationUsage, DictionaryItem, Check, User } from './entities'
import { DictionaryPhrase } from './valueObjects'

/**
 * 仕様パターンの基底インターフェース
 */
export interface Specification<T> {
  isSatisfiedBy(entity: T): boolean
  and(other: Specification<T>): Specification<T>
  or(other: Specification<T>): Specification<T>
  not(): Specification<T>
}

/**
 * 仕様の基底実装
 */
export abstract class BaseSpecification<T> implements Specification<T> {
  abstract isSatisfiedBy(entity: T): boolean

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other)
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other)
  }

  not(): Specification<T> {
    return new NotSpecification(this)
  }
}

/**
 * AND組み合わせ仕様
 */
class AndSpecification<T> extends BaseSpecification<T> {
  constructor(
    private left: Specification<T>,
    private right: Specification<T>
  ) {
    super()
  }

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) && this.right.isSatisfiedBy(entity)
  }
}

/**
 * OR組み合わせ仕様
 */
class OrSpecification<T> extends BaseSpecification<T> {
  constructor(
    private left: Specification<T>,
    private right: Specification<T>
  ) {
    super()
  }

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) || this.right.isSatisfiedBy(entity)
  }
}

/**
 * NOT組み合わせ仕様
 */
class NotSpecification<T> extends BaseSpecification<T> {
  constructor(private spec: Specification<T>) {
    super()
  }

  isSatisfiedBy(entity: T): boolean {
    return !this.spec.isSatisfiedBy(entity)
  }
}

// =============================================================================
// 組織関連の仕様
// =============================================================================

/**
 * 組織が使用制限内かどうかの仕様
 */
export class OrganizationWithinLimitsSpecification extends BaseSpecification<{
  organization: Organization
  usage: OrganizationUsage
}> {
  isSatisfiedBy({ organization, usage }: { organization: Organization; usage: OrganizationUsage }): boolean {
    return organization.isWithinLimits(usage)
  }
}

/**
 * 組織がユーザーを招待可能かの仕様
 */
export class CanInviteUserSpecification extends BaseSpecification<{
  organization: Organization
  currentUserCount: number
}> {
  isSatisfiedBy({ organization, currentUserCount }: { 
    organization: Organization
    currentUserCount: number 
  }): boolean {
    return organization.canInviteUser(currentUserCount)
  }
}

/**
 * 組織がチェックを実行可能かの仕様
 */
export class CanPerformCheckSpecification extends BaseSpecification<{
  organization: Organization
  usage: OrganizationUsage
}> {
  isSatisfiedBy({ organization, usage }: { 
    organization: Organization
    usage: OrganizationUsage 
  }): boolean {
    return usage.monthlyChecks < organization.limits.monthlyChecks
  }
}

/**
 * 組織が辞書項目を作成可能かの仕様
 */
export class CanCreateDictionarySpecification extends BaseSpecification<{
  organization: Organization
  usage: OrganizationUsage
}> {
  isSatisfiedBy({ organization, usage }: { 
    organization: Organization
    usage: OrganizationUsage 
  }): boolean {
    return usage.totalDictionaries < organization.limits.totalDictionaries
  }
}

/**
 * 組織がプレミアム機能を使用可能かの仕様
 */
export class HasPremiumFeaturesSpecification extends BaseSpecification<Organization> {
  isSatisfiedBy(organization: Organization): boolean {
    return organization.subscription === 'premium' || organization.subscription === 'enterprise'
  }
}

/**
 * 組織が試用版かどうかの仕様
 */
export class IsTrialOrganizationSpecification extends BaseSpecification<Organization> {
  isSatisfiedBy(organization: Organization): boolean {
    return organization.subscription === 'trial'
  }
}

// =============================================================================
// ユーザー関連の仕様
// =============================================================================

/**
 * ユーザーが管理者権限を持つかの仕様
 */
export class IsAdminUserSpecification extends BaseSpecification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.isAdmin()
  }
}

/**
 * ユーザーがユーザー管理権限を持つかの仕様
 */
export class CanManageUsersSpecification extends BaseSpecification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.canManageUsers()
  }
}

/**
 * ユーザーが辞書管理権限を持つかの仕様
 */
export class CanManageDictionariesSpecification extends BaseSpecification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.canManageDictionaries()
  }
}

/**
 * ユーザーが特定の組織に属するかの仕様
 */
export class BelongsToOrganizationSpecification extends BaseSpecification<User> {
  constructor(private organizationId: number) {
    super()
  }

  isSatisfiedBy(user: User): boolean {
    return user.organizationId === this.organizationId
  }
}

// =============================================================================
// 辞書項目関連の仕様
// =============================================================================

/**
 * 辞書項目がベクトル埋め込みを持つかの仕様
 */
export class HasEmbeddingSpecification extends BaseSpecification<DictionaryItem> {
  isSatisfiedBy(item: DictionaryItem): boolean {
    return item.hasEmbedding()
  }
}

/**
 * 辞書項目がNG項目かの仕様
 */
export class IsNGPhraseSpecification extends BaseSpecification<DictionaryItem> {
  isSatisfiedBy(item: DictionaryItem): boolean {
    return item.isNGPhrase()
  }
}

/**
 * 辞書項目がALLOW項目かの仕様
 */
export class IsAllowPhraseSpecification extends BaseSpecification<DictionaryItem> {
  isSatisfiedBy(item: DictionaryItem): boolean {
    return item.isAllowPhrase()
  }
}

/**
 * 辞書項目が特定のキーワードを含むかの仕様
 */
export class ContainsKeywordSpecification extends BaseSpecification<DictionaryItem> {
  constructor(private keyword: string) {
    super()
  }

  isSatisfiedBy(item: DictionaryItem): boolean {
    const phrase = DictionaryPhrase.create(item.phrase)
    return phrase.contains(this.keyword)
  }
}

/**
 * 辞書項目が最小長以上かの仕様
 */
export class MinimumLengthSpecification extends BaseSpecification<DictionaryItem> {
  constructor(private minLength: number) {
    super()
  }

  isSatisfiedBy(item: DictionaryItem): boolean {
    return item.phrase.length >= this.minLength
  }
}

/**
 * 辞書項目が特定の組織に属するかの仕様
 */
export class BelongsToOrganizationDictionarySpecification extends BaseSpecification<DictionaryItem> {
  constructor(private organizationId: number) {
    super()
  }

  isSatisfiedBy(item: DictionaryItem): boolean {
    return item.organizationId === this.organizationId
  }
}

// =============================================================================
// チェック関連の仕様
// =============================================================================

/**
 * チェックが完了しているかの仕様
 */
export class IsCompletedCheckSpecification extends BaseSpecification<Check> {
  isSatisfiedBy(check: Check): boolean {
    return check.isCompleted()
  }
}

/**
 * チェックが失敗しているかの仕様
 */
export class IsFailedCheckSpecification extends BaseSpecification<Check> {
  isSatisfiedBy(check: Check): boolean {
    return check.isFailed()
  }
}

/**
 * チェックが違反を含むかの仕様
 */
export class HasViolationsSpecification extends BaseSpecification<Check> {
  isSatisfiedBy(check: Check): boolean {
    return check.hasViolations()
  }
}

/**
 * チェックが高リスクかの仕様
 */
export class IsHighRiskCheckSpecification extends BaseSpecification<Check> {
  constructor(private riskThreshold = 5) {
    super()
  }

  isSatisfiedBy(check: Check): boolean {
    return check.violationCount >= this.riskThreshold
  }
}

/**
 * チェックが特定の期間内に作成されたかの仕様
 */
export class CreatedWithinPeriodSpecification extends BaseSpecification<Check> {
  constructor(private startDate: Date, private endDate: Date) {
    super()
  }

  isSatisfiedBy(check: Check): boolean {
    return check.createdAt >= this.startDate && check.createdAt <= this.endDate
  }
}

/**
 * チェックが特定のユーザーによって作成されたかの仕様
 */
export class CreatedByUserSpecification extends BaseSpecification<Check> {
  constructor(private userId: string) {
    super()
  }

  isSatisfiedBy(check: Check): boolean {
    return check.userId === this.userId
  }
}

/**
 * チェックが特定の組織に属するかの仕様
 */
export class BelongsToOrganizationCheckSpecification extends BaseSpecification<Check> {
  constructor(private organizationId: number) {
    super()
  }

  isSatisfiedBy(check: Check): boolean {
    return check.organizationId === this.organizationId
  }
}

// =============================================================================
// 複合仕様の例
// =============================================================================

/**
 * 組織の健全性を判定する複合仕様
 */
export class HealthyOrganizationSpecification {
  static create(): Specification<{ organization: Organization; usage: OrganizationUsage }> {
    return new OrganizationWithinLimitsSpecification()
      .and(new NotSpecification(new class extends BaseSpecification<{ organization: Organization; usage: OrganizationUsage }> {
        isSatisfiedBy({ organization }: { organization: Organization; usage: OrganizationUsage }): boolean {
          return organization.subscription === 'trial'
        }
      }()))
  }
}

/**
 * 辞書項目の品質を判定する複合仕様
 */
export class QualityDictionaryItemSpecification {
  static create(): Specification<DictionaryItem> {
    return new HasEmbeddingSpecification()
      .and(new MinimumLengthSpecification(3))
  }
}

/**
 * 危険なチェックを判定する複合仕様
 */
export class DangerousCheckSpecification {
  static create(): Specification<Check> {
    return new HasViolationsSpecification()
      .and(new IsHighRiskCheckSpecification(3))
      .and(new IsCompletedCheckSpecification())
  }
}

/**
 * 管理者による操作が可能かを判定する複合仕様
 */
export class AdminOperationAllowedSpecification {
  static create(organizationId: number): Specification<User> {
    return new IsAdminUserSpecification()
      .and(new BelongsToOrganizationSpecification(organizationId))
  }
}

// =============================================================================
// 仕様ファクトリー - よく使う仕様の組み合わせを簡単に作成
// =============================================================================

export class SpecificationFactory {
  /**
   * 組織の操作権限チェック仕様
   */
  static organizationOperationAllowed(
    user: User,
    organization: Organization,
    usage: OrganizationUsage
  ): {
    canInviteUser: boolean
    canCreateCheck: boolean
    canCreateDictionary: boolean
    isWithinLimits: boolean
  } {
    const adminSpec = new IsAdminUserSpecification()
    const belongsSpec = new BelongsToOrganizationSpecification(organization.id)
    const withinLimitsSpec = new OrganizationWithinLimitsSpecification()
    const canInviteSpec = new CanInviteUserSpecification()
    const canCheckSpec = new CanPerformCheckSpecification()
    const canDictSpec = new CanCreateDictionarySpecification()

    const hasPermission = adminSpec.and(belongsSpec).isSatisfiedBy(user)
    const orgUsage = { organization, usage }

    return {
      canInviteUser: hasPermission && canInviteSpec.isSatisfiedBy({ 
        organization, 
        currentUserCount: usage.totalUsers 
      }),
      canCreateCheck: hasPermission && canCheckSpec.isSatisfiedBy(orgUsage),
      canCreateDictionary: hasPermission && canDictSpec.isSatisfiedBy(orgUsage),
      isWithinLimits: withinLimitsSpec.isSatisfiedBy(orgUsage)
    }
  }

  /**
   * 辞書項目フィルタリング仕様
   */
  static dictionaryFiltering(options: {
    organizationId?: number
    hasEmbedding?: boolean
    category?: 'NG' | 'ALLOW'
    keyword?: string
    minLength?: number
  }): Specification<DictionaryItem> {
    let spec: Specification<DictionaryItem> | undefined = undefined

    if (options.organizationId !== undefined) {
      const orgSpec = new BelongsToOrganizationDictionarySpecification(options.organizationId)
      spec = spec ? (spec as Specification<DictionaryItem>).and(orgSpec) : orgSpec
    }

    if (options.hasEmbedding !== undefined) {
      const embeddingSpec = options.hasEmbedding 
        ? new HasEmbeddingSpecification() 
        : new HasEmbeddingSpecification().not()
      spec = spec ? spec.and(embeddingSpec) : embeddingSpec
    }

    if (options.category !== undefined) {
      const categorySpec = options.category === 'NG' 
        ? new IsNGPhraseSpecification()
        : new IsAllowPhraseSpecification()
      spec = spec ? spec.and(categorySpec) : categorySpec
    }

    if (options.keyword !== undefined) {
      const keywordSpec = new ContainsKeywordSpecification(options.keyword)
      spec = spec ? spec.and(keywordSpec) : keywordSpec
    }

    if (options.minLength !== undefined) {
      const lengthSpec = new MinimumLengthSpecification(options.minLength)
      spec = spec ? spec.and(lengthSpec) : lengthSpec
    }

    // デフォルトでは全ての項目を受け入れる仕様を返す
    return spec ?? new class extends BaseSpecification<DictionaryItem> {
      isSatisfiedBy(_: DictionaryItem): boolean { return true }
    }()
  }

  /**
   * チェック分析仕様
   */
  static checkAnalysis(check: Check): {
    isCompleted: boolean
    hasDangerousViolations: boolean
    isHighRisk: boolean
    isRecent: boolean
  } {
    const completedSpec = new IsCompletedCheckSpecification()
    const dangerousSpec = DangerousCheckSpecification.create()
    const highRiskSpec = new IsHighRiskCheckSpecification(5)
    
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)
    const recentSpec = new CreatedWithinPeriodSpecification(oneDayAgo, new Date())

    return {
      isCompleted: completedSpec.isSatisfiedBy(check),
      hasDangerousViolations: dangerousSpec.isSatisfiedBy(check),
      isHighRisk: highRiskSpec.isSatisfiedBy(check),
      isRecent: recentSpec.isSatisfiedBy(check)
    }
  }
}