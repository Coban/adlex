/**
 * Simple in-memory cache implementation for AdLex
 * Provides caching for frequently accessed data to improve performance
 */

interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

class MemoryCache {
  private cache = new Map<string, CacheItem<unknown>>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  /**
   * Set a value in the cache
   */
  set<T>(key: string, value: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl: ttlMs
    })
  }

  /**
   * Get a value from the cache
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null

    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }

    return item.data as T
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        expiredKeys.push(key)
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key))
    
    if (expiredKeys.length > 0) {
      console.log(`[CACHE] Cleaned up ${expiredKeys.length} expired entries`)
    }
  }

  /**
   * Estimate memory usage (rough calculation)
   */
  private estimateMemoryUsage(): string {
    const bytes = JSON.stringify(Array.from(this.cache.entries())).length * 2 // UTF-16
    return `${Math.round(bytes / 1024)} KB`
  }

  /**
   * Destroy the cache and cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clear()
  }
}

// Global cache instance
export const cache = new MemoryCache()

/**
 * Cache decorator for async functions
 */
export function cached<T extends (...args: unknown[]) => Promise<unknown>>(
  keyGenerator: (...args: Parameters<T>) => string,
  ttlMs: number = 5 * 60 * 1000
) {
  return function (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as (...args: Parameters<T>) => ReturnType<T>

    descriptor.value = async function (...args: Parameters<T>) {
      const cacheKey = keyGenerator(...args)
      
      // Check cache first
      const cachedResult = cache.get<Awaited<ReturnType<T>>>(cacheKey)
      if (cachedResult !== null) {
        console.log(`[CACHE] Cache hit for key: ${cacheKey}`)
        return cachedResult
      }

      // Execute original method
      console.log(`[CACHE] Cache miss for key: ${cacheKey}`)
      const result = await originalMethod.apply(this, args) as Awaited<ReturnType<T>>
      
      // Store in cache
      cache.set(cacheKey, result, ttlMs)
      return result
    }

    return descriptor
  }
}

/**
 * Utility functions for common cache operations
 */
export const CacheUtils = {
  /**
   * Generate cache key for organization data
   */
  orgKey: (orgId: number) => `org:${orgId}`,

  /**
   * Generate cache key for user data
   */
  userKey: (userId: string) => `user:${userId}`,

  /**
   * Generate cache key for dictionary search
   */
  dictionarySearchKey: (orgId: number, searchTerm: string) => 
    `dict:${orgId}:${Buffer.from(searchTerm).toString('base64')}`,

  /**
   * Generate cache key for similar phrases
   */
  similarPhrasesKey: (orgId: number, textHash: string) => 
    `similar:${orgId}:${textHash}`,

  /**
   * Generate cache key for queue status
   */
  queueStatusKey: (orgId: number) => `queue:${orgId}`,

  /**
   * Generate cache key for check history
   */
  checkHistoryKey: (orgId: number, userId: string, page: number, search?: string) => 
    `history:${orgId}:${userId}:${page}:${search ?? ''}`,

  /**
   * Simple hash function for text content
   */
  hashText: (text: string): string => {
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }
}

/**
 * Cache middleware for API routes
 */
export function withCache<T>(
  keyFn: (req: Request, ...args: unknown[]) => string,
  ttlMs: number = 5 * 60 * 1000
) {
  return function (handler: (req: Request, ...args: unknown[]) => Promise<T>) {
    return async function (req: Request, ...args: unknown[]): Promise<T> {
      const cacheKey = keyFn(req, ...args)
      
      // Check cache
      const cached = cache.get<T>(cacheKey)
      if (cached !== null) {
        console.log(`[API-CACHE] Cache hit for: ${cacheKey}`)
        return cached
      }

      // Execute handler
      console.log(`[API-CACHE] Cache miss for: ${cacheKey}`)
      const result = await handler(req, ...args)
      
      // Store in cache
      cache.set(cacheKey, result, ttlMs)
      return result
    }
  }
}

/**
 * Invalidate cache entries by pattern
 */
export function invalidatePattern(pattern: RegExp): number {
  const stats = cache.getStats()
  const keysToDelete = stats.keys.filter(key => pattern.test(key))
  
  keysToDelete.forEach(key => cache.delete(key))
  
  if (keysToDelete.length > 0) {
    console.log(`[CACHE] Invalidated ${keysToDelete.length} entries matching pattern: ${pattern}`)
  }
  
  return keysToDelete.length
}

/**
 * Pre-warm cache with commonly accessed data
 */
export async function preWarmCache() {
  console.log('[CACHE] Pre-warming cache with common data...')
  
  try {
    // This would typically load frequently accessed data
    // Implementation depends on specific use cases
    console.log('[CACHE] Cache pre-warming completed')
  } catch (error) {
    console.error('[CACHE] Cache pre-warming failed:', error)
  }
}

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    console.log('[CACHE] Shutting down cache...')
    cache.destroy()
  })
  
  process.on('SIGINT', () => {
    console.log('[CACHE] Shutting down cache...')
    cache.destroy()
  })
}