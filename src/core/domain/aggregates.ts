import { Entity, DictionaryItem, Check, Violation, User, Organization } from './entities'
import { ValidationError } from './errors'
import { DomainEvent } from './events'
import { DictionaryPhrase, EmbeddingVector, TextRange } from './valueObjects'

/**
 * 集約ルート基底クラス
 */
export abstract class AggregateRoot<TId> extends Entity<TId> {
  private _domainEvents: DomainEvent[] = []

  protected constructor(id: TId) {
    super(id)
  }

  /**
   * ドメインイベントを追加
   */
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event)
  }

  /**
   * ドメインイベントを取得してクリア
   */
  public pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents]
    this._domainEvents = []
    return events
  }

  /**
   * 未処理のドメインイベントがあるか
   */
  public hasDomainEvents(): boolean {
    return this._domainEvents.length > 0
  }
}

/**
 * チェック集約 - チェック処理の一連の処理を管理
 */
export class CheckAggregate extends AggregateRoot<number> {
  private _violations: Map<number, Violation> = new Map()
  private _status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  private _completedAt: Date | null = null
  private _errorMessage: string | null = null

  constructor(
    private readonly _check: Check,
    violations: Violation[] = []
  ) {
    super(_check.id)
    this._status = _check.status
    violations.forEach(v => this._violations.set(v.id, v))
  }

  static create(
    id: number,
    userId: string,
    organizationId: number,
    inputText: string,
    extractedText: string | null = null
  ): CheckAggregate {
    const check = new Check(
      id,
      userId,
      organizationId,
      inputText,
      extractedText,
      'pending',
      0,
      new Date(),
      null
    )

    const aggregate = new CheckAggregate(check)
    
    // ドメインイベントを発行
    aggregate.addDomainEvent({
      eventType: 'CheckCreated',
      aggregateId: id.toString(),
      data: {
        checkId: id,
        userId,
        organizationId,
        inputText: inputText.length > 100 ? inputText.substring(0, 100) + '...' : inputText,
        createdAt: new Date().toISOString()
      },
      occurredAt: new Date()
    })

    return aggregate
  }

  /**
   * チェック処理を開始
   */
  startProcessing(): void {
    if (this._status !== 'pending') {
      throw new ValidationError('処理開始できる状態ではありません')
    }

    this._status = 'processing'
    this.addDomainEvent({
      eventType: 'CheckProcessingStarted',
      aggregateId: this.id.toString(),
      data: {
        checkId: this.id,
        startedAt: new Date().toISOString()
      },
      occurredAt: new Date()
    })
  }

  /**
   * 違反を追加
   */
  addViolation(
    violationId: number,
    dictionaryId: number | null,
    originalText: string,
    suggestedText: string | null,
    reasoning: string | null,
    range: TextRange
  ): void {
    if (this._status !== 'processing') {
      throw new ValidationError('処理中でない場合は違反を追加できません')
    }

    const violation = new Violation(
      violationId,
      this.id,
      dictionaryId,
      originalText,
      suggestedText,
      reasoning,
      range.start,
      range.end,
      new Date()
    )

    this._violations.set(violationId, violation)

    this.addDomainEvent({
      eventType: 'ViolationDetected',
      aggregateId: this.id.toString(),
      data: {
        checkId: this.id,
        violationId,
        originalText,
        suggestedText,
        startPos: range.start,
        endPos: range.end,
        dictionaryId
      },
      occurredAt: new Date()
    })
  }

  /**
   * 処理を完了
   */
  complete(): void {
    if (this._status !== 'processing') {
      throw new ValidationError('処理中でない場合は完了できません')
    }

    this._status = 'completed'
    this._completedAt = new Date()

    const violationCount = this._violations.size

    this.addDomainEvent({
      eventType: 'CheckCompleted',
      aggregateId: this.id.toString(),
      data: {
        checkId: this.id,
        violationCount,
        completedAt: this._completedAt.toISOString(),
        hasViolations: violationCount > 0
      },
      occurredAt: new Date()
    })
  }

  /**
   * 処理を失敗
   */
  fail(errorMessage: string): void {
    if (this._status !== 'processing') {
      throw new ValidationError('処理中でない場合は失敗できません')
    }

    this._status = 'failed'
    this._errorMessage = errorMessage
    this._completedAt = new Date()

    this.addDomainEvent({
      eventType: 'CheckFailed',
      aggregateId: this.id.toString(),
      data: {
        checkId: this.id,
        errorMessage,
        failedAt: this._completedAt.toISOString()
      },
      occurredAt: new Date()
    })
  }

  /**
   * 処理をキャンセル
   */
  cancel(): void {
    if (this._status === 'completed' || this._status === 'failed') {
      throw new ValidationError('既に完了した処理はキャンセルできません')
    }

    this._status = 'cancelled'
    this._completedAt = new Date()

    this.addDomainEvent({
      eventType: 'CheckCancelled',
      aggregateId: this.id.toString(),
      data: {
        checkId: this.id,
        cancelledAt: this._completedAt.toISOString()
      },
      occurredAt: new Date()
    })
  }

  // ゲッター
  get check(): Check {
    return this._check
  }

  get violations(): Violation[] {
    return Array.from(this._violations.values())
  }

  get status(): 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' {
    return this._status
  }

  get completedAt(): Date | null {
    return this._completedAt
  }

  get errorMessage(): string | null {
    return this._errorMessage
  }

  get violationCount(): number {
    return this._violations.size
  }
}

/**
 * 辞書集約 - 辞書項目の管理とベクトル生成を管理
 */
export class DictionaryAggregate extends AggregateRoot<number> {
  private _vector: EmbeddingVector | null = null
  private _isVectorGenerating = false

  constructor(
    private readonly _dictionaryItem: DictionaryItem,
    vector?: number[] | null
  ) {
    super(_dictionaryItem.id)
    if (vector) {
      this._vector = EmbeddingVector.create(vector)
    }
  }

  static create(
    id: number,
    phrase: string,
    category: 'NG' | 'ALLOW',
    organizationId: number,
    notes: string | null = null
  ): DictionaryAggregate {
    const dictionaryPhrase = DictionaryPhrase.create(phrase)
    
    const item = new DictionaryItem(
      id,
      dictionaryPhrase.value,
      category,
      organizationId,
      null,
      notes,
      new Date(),
      new Date()
    )

    const aggregate = new DictionaryAggregate(item)

    aggregate.addDomainEvent({
      eventType: 'DictionaryItemCreated',
      aggregateId: id.toString(),
      data: {
        dictionaryId: id,
        phrase,
        category,
        organizationId,
        createdAt: new Date().toISOString()
      },
      occurredAt: new Date()
    })

    return aggregate
  }

  /**
   * ベクトル生成を開始
   */
  startVectorGeneration(): void {
    if (this._isVectorGenerating) {
      throw new ValidationError('既にベクトル生成中です')
    }

    this._isVectorGenerating = true

    this.addDomainEvent({
      eventType: 'VectorGenerationStarted',
      aggregateId: this.id.toString(),
      data: {
        dictionaryId: this.id,
        phrase: this._dictionaryItem.phrase,
        startedAt: new Date().toISOString()
      },
      occurredAt: new Date()
    })
  }

  /**
   * ベクトルを設定
   */
  setVector(vector: number[]): void {
    if (!this._isVectorGenerating) {
      throw new ValidationError('ベクトル生成が開始されていません')
    }

    this._vector = EmbeddingVector.create(vector)
    this._isVectorGenerating = false

    this.addDomainEvent({
      eventType: 'VectorGenerated',
      aggregateId: this.id.toString(),
      data: {
        dictionaryId: this.id,
        vectorDimensions: vector.length,
        completedAt: new Date().toISOString()
      },
      occurredAt: new Date()
    })
  }

  /**
   * ベクトル生成に失敗
   */
  failVectorGeneration(errorMessage: string): void {
    if (!this._isVectorGenerating) {
      throw new ValidationError('ベクトル生成が開始されていません')
    }

    this._isVectorGenerating = false

    this.addDomainEvent({
      eventType: 'VectorGenerationFailed',
      aggregateId: this.id.toString(),
      data: {
        dictionaryId: this.id,
        errorMessage,
        failedAt: new Date().toISOString()
      },
      occurredAt: new Date()
    })
  }

  /**
   * 辞書項目を更新
   */
  updateContent(newPhrase?: string, newCategory?: 'NG' | 'ALLOW', _newNotes?: string): void {
    const hasContentChanged = 
      (newPhrase && newPhrase !== this._dictionaryItem.phrase) ??
      (newCategory && newCategory !== this._dictionaryItem.category)

    if (hasContentChanged) {
      // 内容が変更された場合はベクトルを無効化
      this._vector = null

      this.addDomainEvent({
        eventType: 'DictionaryItemUpdated',
        aggregateId: this.id.toString(),
        data: {
          dictionaryId: this.id,
          oldPhrase: this._dictionaryItem.phrase,
          newPhrase: newPhrase ?? this._dictionaryItem.phrase,
          oldCategory: this._dictionaryItem.category,
          newCategory: newCategory ?? this._dictionaryItem.category,
          vectorInvalidated: hasContentChanged,
          updatedAt: new Date().toISOString()
        },
        occurredAt: new Date()
      })
    }
  }

  // ゲッター
  get dictionaryItem(): DictionaryItem {
    return this._dictionaryItem
  }

  get vector(): EmbeddingVector | null {
    return this._vector
  }

  get isVectorGenerating(): boolean {
    return this._isVectorGenerating
  }

  get hasVector(): boolean {
    return this._vector !== null
  }
}

/**
 * 組織集約 - 組織とユーザーの管理
 */
export class OrganizationAggregate extends AggregateRoot<number> {
  private _users: Map<string, User> = new Map()

  constructor(
    private readonly _organization: Organization,
    users: User[] = []
  ) {
    super(_organization.id)
    users.forEach(user => this._users.set(user.id, user))
  }

  /**
   * ユーザーを招待
   */
  inviteUser(userId: string, email: string, role: 'admin' | 'user'): void {
    if (!this._organization.canInviteUser(this._users.size)) {
      throw new ValidationError('ユーザー数の制限に達しています')
    }

    this.addDomainEvent({
      eventType: 'UserInvited',
      aggregateId: this.id.toString(),
      data: {
        organizationId: this.id,
        userId,
        email,
        role,
        invitedAt: new Date().toISOString()
      },
      occurredAt: new Date()
    })
  }

  /**
   * ユーザーを追加
   */
  addUser(user: User): void {
    if (user.organizationId !== this.id) {
      throw new ValidationError('異なる組織のユーザーは追加できません')
    }

    if (!this._organization.canInviteUser(this._users.size)) {
      throw new ValidationError('ユーザー数の制限に達しています')
    }

    this._users.set(user.id, user)

    this.addDomainEvent({
      eventType: 'UserAdded',
      aggregateId: this.id.toString(),
      data: {
        organizationId: this.id,
        userId: user.id,
        email: user.email,
        role: user.role,
        addedAt: new Date().toISOString()
      },
      occurredAt: new Date()
    })
  }

  /**
   * ユーザーの役割を変更
   */
  changeUserRole(userId: string, newRole: 'admin' | 'user'): void {
    const user = this._users.get(userId)
    if (!user) {
      throw new ValidationError('ユーザーが見つかりません')
    }

    if (user.role === newRole) {
      return // 変更なし
    }

    this.addDomainEvent({
      eventType: 'UserRoleChanged',
      aggregateId: this.id.toString(),
      data: {
        organizationId: this.id,
        userId,
        oldRole: user.role,
        newRole,
        changedAt: new Date().toISOString()
      },
      occurredAt: new Date()
    })
  }

  // ゲッター
  get organization(): Organization {
    return this._organization
  }

  get users(): User[] {
    return Array.from(this._users.values())
  }

  get userCount(): number {
    return this._users.size
  }
}