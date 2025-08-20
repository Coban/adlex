/**
 * ドメインイベントの基底インターフェース
 */
export interface DomainEvent {
  eventType: string
  aggregateId: string
  data: Record<string, unknown>
  occurredAt: Date
  eventId?: string
}

/**
 * チェック関連のドメインイベント
 */

export interface CheckCreatedEvent extends DomainEvent {
  eventType: 'CheckCreated'
  data: {
    checkId: number
    userId: string
    organizationId: number
    inputText: string
    createdAt: string
  }
}

export interface CheckProcessingStartedEvent extends DomainEvent {
  eventType: 'CheckProcessingStarted'
  data: {
    checkId: number
    startedAt: string
  }
}

export interface ViolationDetectedEvent extends DomainEvent {
  eventType: 'ViolationDetected'
  data: {
    checkId: number
    violationId: number
    originalText: string
    suggestedText: string | null
    startPos: number
    endPos: number
    dictionaryId: number | null
  }
}

export interface CheckCompletedEvent extends DomainEvent {
  eventType: 'CheckCompleted'
  data: {
    checkId: number
    violationCount: number
    completedAt: string
    hasViolations: boolean
  }
}

export interface CheckFailedEvent extends DomainEvent {
  eventType: 'CheckFailed'
  data: {
    checkId: number
    errorMessage: string
    failedAt: string
  }
}

export interface CheckCancelledEvent extends DomainEvent {
  eventType: 'CheckCancelled'
  data: {
    checkId: number
    cancelledAt: string
  }
}

/**
 * 辞書関連のドメインイベント
 */

export interface DictionaryItemCreatedEvent extends DomainEvent {
  eventType: 'DictionaryItemCreated'
  data: {
    dictionaryId: number
    phrase: string
    category: 'NG' | 'ALLOW'
    organizationId: number
    createdAt: string
  }
}

export interface DictionaryItemUpdatedEvent extends DomainEvent {
  eventType: 'DictionaryItemUpdated'
  data: {
    dictionaryId: number
    oldPhrase: string
    newPhrase: string
    oldCategory: 'NG' | 'ALLOW'
    newCategory: 'NG' | 'ALLOW'
    vectorInvalidated: boolean
    updatedAt: string
  }
}

export interface VectorGenerationStartedEvent extends DomainEvent {
  eventType: 'VectorGenerationStarted'
  data: {
    dictionaryId: number
    phrase: string
    startedAt: string
  }
}

export interface VectorGeneratedEvent extends DomainEvent {
  eventType: 'VectorGenerated'
  data: {
    dictionaryId: number
    vectorDimensions: number
    completedAt: string
  }
}

export interface VectorGenerationFailedEvent extends DomainEvent {
  eventType: 'VectorGenerationFailed'
  data: {
    dictionaryId: number
    errorMessage: string
    failedAt: string
  }
}

/**
 * ユーザー・組織関連のドメインイベント
 */

export interface UserInvitedEvent extends DomainEvent {
  eventType: 'UserInvited'
  data: {
    organizationId: number
    userId: string
    email: string
    role: 'admin' | 'user'
    invitedAt: string
  }
}

export interface UserAddedEvent extends DomainEvent {
  eventType: 'UserAdded'
  data: {
    organizationId: number
    userId: string
    email: string
    role: 'admin' | 'user'
    addedAt: string
  }
}

export interface UserRoleChangedEvent extends DomainEvent {
  eventType: 'UserRoleChanged'
  data: {
    organizationId: number
    userId: string
    oldRole: 'admin' | 'user'
    newRole: 'admin' | 'user'
    changedAt: string
  }
}

/**
 * ドメインイベントのユニオン型
 */
export type AllDomainEvents = 
  | CheckCreatedEvent
  | CheckProcessingStartedEvent
  | ViolationDetectedEvent
  | CheckCompletedEvent
  | CheckFailedEvent
  | CheckCancelledEvent
  | DictionaryItemCreatedEvent
  | DictionaryItemUpdatedEvent
  | VectorGenerationStartedEvent
  | VectorGeneratedEvent
  | VectorGenerationFailedEvent
  | UserInvitedEvent
  | UserAddedEvent
  | UserRoleChangedEvent

/**
 * ドメインイベントハンドラーインターフェース
 */
export interface DomainEventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>
  canHandle(eventType: string): boolean
}

/**
 * ドメインイベントパブリッシャーインターフェース
 */
export interface DomainEventPublisher {
  publish(event: DomainEvent): Promise<void>
  publishAll(events: DomainEvent[]): Promise<void>
}

/**
 * ドメインイベントストアインターフェース
 */
export interface DomainEventStore {
  append(aggregateId: string, events: DomainEvent[]): Promise<void>
  getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]>
  getAllEventsOfType(eventType: string, fromDate?: Date): Promise<DomainEvent[]>
}

/**
 * メモリ内ドメインイベントパブリッシャー（開発・テスト用）
 */
export class InMemoryDomainEventPublisher implements DomainEventPublisher {
  private handlers: Map<string, DomainEventHandler[]> = new Map()

  /**
   * イベントハンドラーを登録
   */
  subscribe<T extends DomainEvent>(eventType: string, handler: DomainEventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, [])
    }
    this.handlers.get(eventType)!.push(handler as DomainEventHandler)
  }

  /**
   * 単一のイベントを発行
   */
  async publish(event: DomainEvent): Promise<void> {
    const eventId = this.generateEventId()
    const eventWithId = { ...event, eventId }

    console.log(`[DomainEvent] Publishing: ${event.eventType}`, {
      aggregateId: event.aggregateId,
      eventId,
      occurredAt: event.occurredAt
    })

    const handlers = this.handlers.get(event.eventType) ?? []
    
    // ハンドラーを並列実行
    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler.handle(eventWithId)
        } catch (error) {
          console.error(`[DomainEvent] Handler failed for ${event.eventType}:`, error)
          // ハンドラーのエラーは他のハンドラーの実行を妨げない
        }
      })
    )
  }

  /**
   * 複数のイベントを発行
   */
  async publishAll(events: DomainEvent[]): Promise<void> {
    // イベントは順次実行（因果関係を維持するため）
    for (const event of events) {
      await this.publish(event)
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * ドメインイベントの統計情報を収集するハンドラー
 */
export class EventStatisticsHandler implements DomainEventHandler {
  private statistics: Map<string, number> = new Map()

  async handle(event: DomainEvent): Promise<void> {
    const current = this.statistics.get(event.eventType) ?? 0
    this.statistics.set(event.eventType, current + 1)
    
    console.log(`[EventStats] ${event.eventType}: ${current + 1} total`)
  }

  canHandle(_eventType: string): boolean {
    return true // 全てのイベントタイプを処理
  }

  getStatistics(): Record<string, number> {
    return Object.fromEntries(this.statistics)
  }

  reset(): void {
    this.statistics.clear()
  }
}

/**
 * チェック完了時の通知ハンドラー（例）
 */
export class CheckCompletionNotificationHandler implements DomainEventHandler<CheckCompletedEvent> {
  async handle(event: CheckCompletedEvent): Promise<void> {
    const { checkId, violationCount, hasViolations } = event.data
    
    console.log(`[Notification] Check ${checkId} completed:`, {
      violationCount,
      hasViolations,
      riskLevel: hasViolations ? 'requires_attention' : 'safe'
    })

    // 実際の実装では、メール送信、Slack通知、ダッシュボード更新など
    if (hasViolations) {
      // 高リスクの場合は即座に通知
      await this.sendHighRiskNotification(checkId, violationCount)
    }
  }

  canHandle(eventType: string): boolean {
    return eventType === 'CheckCompleted'
  }

  private async sendHighRiskNotification(checkId: number, violationCount: number): Promise<void> {
    // 通知ロジック（実装は省略）
    console.log(`[Alert] High risk check detected: ${checkId} with ${violationCount} violations`)
  }
}

/**
 * ベクトル生成完了時のインデックス更新ハンドラー（例）
 */
export class VectorIndexUpdateHandler implements DomainEventHandler<VectorGeneratedEvent> {
  async handle(event: VectorGeneratedEvent): Promise<void> {
    const { dictionaryId, vectorDimensions } = event.data
    
    console.log(`[VectorIndex] Updating index for dictionary ${dictionaryId}:`, {
      dimensions: vectorDimensions
    })

    // 実際の実装では、ベクトルデータベース（Pinecone、Weaviateなど）の更新
    await this.updateVectorIndex(dictionaryId)
  }

  canHandle(eventType: string): boolean {
    return eventType === 'VectorGenerated'
  }

  private async updateVectorIndex(dictionaryId: number): Promise<void> {
    // ベクトルインデックス更新ロジック（実装は省略）
    console.log(`[VectorIndex] Index updated for dictionary ${dictionaryId}`)
  }
}