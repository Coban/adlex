import { 
  DictionaryAggregate, 
  InMemoryDomainEventPublisher,
  CanManageDictionariesSpecification,
  BelongsToOrganizationSpecification,
  OrganizationWithinLimitsSpecification,
  CanCreateDictionarySpecification,
  User,
  Organization,
  OrganizationUsage
} from '@/core/domain'
import { ValidationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

/**
 * ドメイン層を活用した辞書作成ユースケース
 */
export interface CreateDictionaryWithDomainInput {
  currentUserId: string
  organizationId: number
  phrase: string
  category: 'NG' | 'ALLOW'
  notes?: string
}

export interface CreateDictionaryWithDomainOutput {
  dictionaryId: number
  phrase: string
  category: string
  hasVector: boolean
  events: string[]
  message: string
}

export type CreateDictionaryWithDomainResult = 
  | { success: true; data: CreateDictionaryWithDomainOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * ドメイン駆動設計を活用した辞書作成ユースケース
 * 
 * 新しいドメイン要素の使用例：
 * - Aggregate: ドメインロジックの集約管理
 * - Specification: ビジネスルールの表現
 * - Domain Events: 処理結果の通知
 */
export class CreateDictionaryWithDomainUseCase {
  constructor(
    private repositories: RepositoryContainer,
    private eventPublisher = new InMemoryDomainEventPublisher()
  ) {
    // イベントハンドラーの設定
    this.setupEventHandlers()
  }

  async execute(input: CreateDictionaryWithDomainInput): Promise<CreateDictionaryWithDomainResult> {
    try {
      // 1. ドメイン仕様による権限チェック
      const authResult = await this.checkPermissions(input.currentUserId, input.organizationId)
      if (!authResult.success) {
        return {
          success: false,
          error: { code: authResult.errorCode, message: authResult.errorMessage }
        }
      }

      const { organization, currentUsage } = authResult

      // 2. 組織制限の仕様チェック
      const withinLimitsSpec = new OrganizationWithinLimitsSpecification()
      const canCreateSpec = new CanCreateDictionarySpecification()
      
      if (!withinLimitsSpec.isSatisfiedBy({ organization, usage: currentUsage })) {
        return {
          success: false,
          error: { code: 'USAGE_LIMIT_EXCEEDED', message: '組織の使用制限に達しています' }
        }
      }

      if (!canCreateSpec.isSatisfiedBy({ organization, usage: currentUsage })) {
        return {
          success: false,
          error: { code: 'DICTIONARY_LIMIT_EXCEEDED', message: '辞書項目数の制限に達しています' }
        }
      }

      // 3. 辞書集約を作成
      const dictionaryId = await this.generateNewId()
      const dictionaryAggregate = DictionaryAggregate.create(
        dictionaryId,
        input.phrase,
        input.category,
        input.organizationId,
        input.notes
      )

      // 4. データベースに保存
      await this.repositories.dictionaries.create({
        id: dictionaryId,
        phrase: input.phrase,
        category: input.category,
        organization_id: input.organizationId,
        notes: input.notes ?? null,
        vector: null, // ベクトルは後で非同期生成
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

      // 5. ベクトル生成を開始（非同期）
      dictionaryAggregate.startVectorGeneration()

      // 6. ドメインイベントを発行
      const domainEvents = dictionaryAggregate.pullDomainEvents()
      await this.eventPublisher.publishAll(domainEvents)

      // 7. 結果を返す
      return {
        success: true,
        data: {
          dictionaryId,
          phrase: input.phrase,
          category: input.category,
          hasVector: dictionaryAggregate.hasVector,
          events: domainEvents.map(e => e.eventType),
          message: '辞書項目を作成しました。ベクトル生成を開始します。'
        }
      }

    } catch (error) {
      console.error('Dictionary creation failed:', error)
      
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.message }
        }
      }

      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '辞書作成に失敗しました' }
      }
    }
  }

  /**
   * ドメイン仕様を使用した権限チェック
   */
  /**
   * Supabaseのユーザーオブジェクトをドメインエンティティに変換
   */
  private convertToUserEntity(userData: {
    id: string
    email: string | null
    role: 'admin' | 'user' | null
    organization_id: number | null
    created_at: string | null
    updated_at: string | null
  }): User {
    return new User(
      userData.id,
      userData.email ?? '',
      userData.role ?? 'user',
      userData.organization_id ?? 0,
      new Date(userData.created_at ?? Date.now()),
      new Date(userData.updated_at ?? Date.now())
    )
  }

  /**
   * Supabaseの組織オブジェクトをドメインエンティティに変換
   */
  private convertToOrganizationEntity(orgData: {
    id: number
    name: string
    plan?: 'trial' | 'basic' | 'premium' | 'enterprise' | null
    max_checks?: number | null
    created_at: string | null
    updated_at: string | null
  }): Organization {
    return new Organization(
      orgData.id,
      orgData.name,
      orgData.plan ?? 'trial',
      {
        monthlyChecks: orgData.max_checks ?? 100,
        totalDictionaries: 1000,
        totalUsers: 5,
        storageGB: 10
      },
      new Date(orgData.created_at ?? Date.now()),
      new Date(orgData.updated_at ?? Date.now())
    )
  }

  private async checkPermissions(userId: string, organizationId: number): Promise<{
    success: true
    user: User
    organization: Organization
    currentUsage: OrganizationUsage
  } | {
    success: false
    errorCode: string
    errorMessage: string
  }> {
    // ユーザー情報を取得
    const userData = await this.repositories.users.findById(userId)
    if (!userData) {
      return {
        success: false,
        errorCode: 'AUTHENTICATION_ERROR',
        errorMessage: 'ユーザーが見つかりません'
      }
    }

    // ドメインエンティティに変換
    const user = this.convertToUserEntity(userData)

    // 組織所属の仕様チェック
    const belongsToOrgSpec = new BelongsToOrganizationSpecification(organizationId)
    if (!belongsToOrgSpec.isSatisfiedBy(user)) {
      return {
        success: false,
        errorCode: 'AUTHORIZATION_ERROR',
        errorMessage: 'この組織へのアクセス権がありません'
      }
    }

    // 辞書管理権限の仕様チェック
    const canManageSpec = new CanManageDictionariesSpecification()
    if (!canManageSpec.isSatisfiedBy(user)) {
      return {
        success: false,
        errorCode: 'AUTHORIZATION_ERROR',
        errorMessage: '辞書管理権限が必要です'
      }
    }

    // 組織情報を取得
    const orgData = await this.repositories.organizations.findById(organizationId)
    if (!orgData) {
      return {
        success: false,
        errorCode: 'NOT_FOUND_ERROR',
        errorMessage: '組織が見つかりません'
      }
    }

    // ドメインエンティティに変換
    const organization = this.convertToOrganizationEntity(orgData)

    // 現在の使用状況を取得
    const currentUsage = await this.getCurrentUsage(organizationId)

    return {
      success: true,
      user,
      organization,
      currentUsage
    }
  }

  /**
   * 現在の使用状況を取得
   */
  private async getCurrentUsage(organizationId: number) {
    // 実際の実装では各リポジトリから統計を取得
    const [dictionaries, users, checks] = await Promise.all([
      this.repositories.dictionaries.findByOrganizationId(organizationId),
      this.repositories.users.findByOrganizationId(organizationId),
      // チェック履歴は単純に組織IDでフィルタリング
      this.repositories.checks.findByOrganizationId(organizationId)
    ])

    return {
      totalDictionaries: dictionaries.length,
      totalUsers: users.length,
      monthlyChecks: checks.length,
      storageUsedGB: 0 // 実装省略
    }
  }

  /**
   * 新しいIDを生成
   */
  private async generateNewId(): Promise<number> {
    // 実際の実装では、データベースのシーケンスやUUIDを使用
    return Date.now() % 1000000
  }

  /**
   * イベントハンドラーの設定
   */
  private setupEventHandlers(): void {
    // 辞書項目作成時のベクトル生成開始
    this.eventPublisher.subscribe('DictionaryItemCreated', {
      async handle(event) {
        console.log(`[Domain] Dictionary item created: ${event.data.dictionaryId}`)
        console.log(`[Domain] Starting vector generation for phrase: "${event.data.phrase}"`)
        // 実際の実装では、バックグラウンドジョブを開始
      },
      canHandle: (eventType) => eventType === 'DictionaryItemCreated'
    })

    // ベクトル生成開始時のログ
    this.eventPublisher.subscribe('VectorGenerationStarted', {
      async handle(event) {
        console.log(`[Domain] Vector generation started for dictionary: ${event.data.dictionaryId}`)
        console.log(`[Domain] Phrase: "${event.data.phrase}"`)
        // 実際の実装では、AI API呼び出しを開始
      },
      canHandle: (eventType) => eventType === 'VectorGenerationStarted'
    })
  }
}

/**
 * 使用例とテストのヘルパー
 */
export class DomainUsageExample {
  /**
   * 辞書作成の使用例
   */
  static async demonstrateUsage(repositories: RepositoryContainer): Promise<void> {
    console.log('=== ドメイン駆動設計 使用例 ===')
    
    const useCase = new CreateDictionaryWithDomainUseCase(repositories)
    
    const result = await useCase.execute({
      currentUserId: 'user123',
      organizationId: 1,
      phrase: '効果抜群',
      category: 'NG',
      notes: '薬機法違反の可能性があります'
    })

    if (result.success) {
      console.log('✅ 辞書作成成功:', result.data)
      console.log('📧 発行されたイベント:', result.data.events)
    } else {
      console.log('❌ 辞書作成失敗:', result.error)
    }
  }

  /**
   * 仕様パターンの使用例
   */
  static demonstrateSpecifications(): void {
    console.log('=== 仕様パターン 使用例 ===')
    
    console.log('🔍 複合仕様を作成: 管理者権限 AND 組織所属')
    console.log('📋 この仕様は辞書管理権限の判定に使用されます')
  }
}