/**
 * SSE接続プール管理
 * EventSource接続の効率的な管理と再利用を提供
 */

import { logger } from '@/lib/logger'

interface SSEConnection {
  eventSource: EventSource
  url: string
  createdAt: number
  lastUsed: number
  subscribers: Set<string>
  cleanupTimer?: NodeJS.Timeout
}

interface SSEPoolConfig {
  maxConnections: number
  connectionTimeout: number // 接続のタイムアウト時間（ミリ秒）
  cleanupInterval: number   // 未使用接続のクリーンアップ間隔（ミリ秒）
}

const DEFAULT_CONFIG: SSEPoolConfig = {
  maxConnections: 10,
  connectionTimeout: 30000,  // 30秒
  cleanupInterval: 60000     // 1分
}

class SSEConnectionPool {
  private connections = new Map<string, SSEConnection>()
  private config: SSEPoolConfig
  private cleanupTimer?: NodeJS.Timeout

  constructor(config: Partial<SSEPoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.startCleanupTimer()
  }

  /**
   * 接続を取得または作成
   * @param url SSE接続URL
   * @param subscriberId 購読者ID
   * @returns EventSource
   */
  getConnection(url: string, subscriberId: string): EventSource {
    const existing = this.connections.get(url)
    
    if (existing && existing.eventSource.readyState !== EventSource.CLOSED) {
      // 既存接続を再利用
      existing.lastUsed = Date.now()
      existing.subscribers.add(subscriberId)
      this.clearConnectionCleanup(url)
      
      logger.debug('SSE connection reused', {
        url,
        subscriberId,
        totalSubscribers: existing.subscribers.size
      })
      
      return existing.eventSource
    }

    // 新しい接続を作成
    if (this.connections.size >= this.config.maxConnections) {
      this.evictOldestConnection()
    }

    const eventSource = new EventSource(url)
    const connection: SSEConnection = {
      eventSource,
      url,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      subscribers: new Set([subscriberId])
    }

    this.connections.set(url, connection)
    
    // 接続エラー時の自動クリーンアップ
    eventSource.onerror = (event) => {
      logger.error('SSE connection error in pool', {
        url,
        readyState: eventSource.readyState,
        event
      })
      
      // 接続エラー時は少し遅れてクリーンアップ
      setTimeout(() => {
        this.removeConnection(url)
      }, 1000)
    }

    logger.info('New SSE connection created', {
      url,
      subscriberId,
      totalConnections: this.connections.size
    })

    return eventSource
  }

  /**
   * 接続から購読者を削除
   * @param url SSE接続URL
   * @param subscriberId 購読者ID
   */
  unsubscribe(url: string, subscriberId: string): void {
    const connection = this.connections.get(url)
    if (!connection) return

    connection.subscribers.delete(subscriberId)

    logger.debug('SSE subscriber removed', {
      url,
      subscriberId,
      remainingSubscribers: connection.subscribers.size
    })

    // 購読者がいなくなったら遅延クリーンアップを設定
    if (connection.subscribers.size === 0) {
      this.scheduleConnectionCleanup(url)
    }
  }

  /**
   * 特定接続を強制的に削除
   * @param url SSE接続URL
   */
  removeConnection(url: string): void {
    const connection = this.connections.get(url)
    if (!connection) return

    this.clearConnectionCleanup(url)
    
    try {
      if (connection.eventSource.readyState !== EventSource.CLOSED) {
        connection.eventSource.close()
      }
    } catch (error) {
      logger.warn('Error closing EventSource', {
        url,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    this.connections.delete(url)

    logger.info('SSE connection removed', {
      url,
      subscribers: connection.subscribers.size,
      totalConnections: this.connections.size
    })
  }

  /**
   * 古い接続を削除（LRU方式）
   */
  private evictOldestConnection(): void {
    let oldestUrl = ''
    let oldestTime = Date.now()

    for (const [url, connection] of this.connections.entries()) {
      if (connection.lastUsed < oldestTime) {
        oldestTime = connection.lastUsed
        oldestUrl = url
      }
    }

    if (oldestUrl) {
      logger.info('Evicting oldest SSE connection', {
        url: oldestUrl,
        age: Date.now() - oldestTime
      })
      this.removeConnection(oldestUrl)
    }
  }

  /**
   * 未使用接続のクリーンアップをスケジュール
   * @param url SSE接続URL
   */
  private scheduleConnectionCleanup(url: string): void {
    const connection = this.connections.get(url)
    if (!connection) return

    connection.cleanupTimer = setTimeout(() => {
      // まだ購読者がいない場合のみクリーンアップ
      if (connection.subscribers.size === 0) {
        this.removeConnection(url)
      }
    }, this.config.connectionTimeout)

    logger.debug('SSE connection cleanup scheduled', {
      url,
      timeout: this.config.connectionTimeout
    })
  }

  /**
   * スケジュールされたクリーンアップをキャンセル
   * @param url SSE接続URL
   */
  private clearConnectionCleanup(url: string): void {
    const connection = this.connections.get(url)
    if (connection?.cleanupTimer) {
      clearTimeout(connection.cleanupTimer)
      delete connection.cleanupTimer
    }
  }

  /**
   * 定期的なクリーンアップタイマーを開始
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      const connectionsToRemove: string[] = []

      for (const [url, connection] of this.connections.entries()) {
        const isStale = now - connection.lastUsed > this.config.connectionTimeout
        const isClosed = connection.eventSource.readyState === EventSource.CLOSED
        const hasNoSubscribers = connection.subscribers.size === 0

        if ((isStale && hasNoSubscribers) || isClosed) {
          connectionsToRemove.push(url)
        }
      }

      connectionsToRemove.forEach(url => this.removeConnection(url))

      if (connectionsToRemove.length > 0) {
        logger.debug('Periodic SSE cleanup completed', {
          removed: connectionsToRemove.length,
          remaining: this.connections.size
        })
      }
    }, this.config.cleanupInterval)
  }

  /**
   * プール全体をクリーンアップ
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    for (const url of this.connections.keys()) {
      this.removeConnection(url)
    }

    logger.info('SSE connection pool destroyed')
  }

  /**
   * プール統計を取得
   */
  getStats() {
    const stats = {
      totalConnections: this.connections.size,
      connectionsByUrl: {} as Record<string, {
        subscribers: number
        age: number
        readyState: number
      }>
    }

    const now = Date.now()
    for (const [url, connection] of this.connections.entries()) {
      stats.connectionsByUrl[url] = {
        subscribers: connection.subscribers.size,
        age: now - connection.createdAt,
        readyState: connection.eventSource.readyState
      }
    }

    return stats
  }
}

// シングルトンインスタンス
export const ssePool = new SSEConnectionPool()

// デバッグ用：グローバルウィンドウオブジェクトに追加（開発環境のみ）
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as unknown as { ssePool: SSEConnectionPool }).ssePool = ssePool
}