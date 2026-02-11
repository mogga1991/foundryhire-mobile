import * as crypto from 'crypto'
import { createLogger } from '@/lib/logger'

const logger = createLogger('ai-cache')

/**
 * Simple in-memory LRU cache for AI analysis results
 * Reduces redundant API calls for identical analysis requests
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
  size: number // Approximate size for LRU eviction
}

interface CacheStats {
  hits: number
  misses: number
  evictions: number
  size: number
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private accessOrder = new Map<string, number>() // Track access time for LRU
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0, size: 0 }
  private accessCounter = 0

  constructor(
    private maxSize: number = 100,
    private defaultTTL: number = 60 * 60 * 1000 // 1 hour default
  ) {}

  /**
   * Generate a cache key from input data
   */
  private hashKey(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return undefined
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key)
      this.accessOrder.delete(key)
      this.stats.size--
      this.stats.misses++
      return undefined
    }

    // Update access order
    this.accessCounter++
    this.accessOrder.set(key, this.accessCounter)
    this.stats.hits++

    logger.debug({ message: 'Cache hit', key: key.slice(0, 16) })
    return entry.value
  }

  /**
   * Set a value in cache with optional TTL
   */
  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs || this.defaultTTL

    // If at capacity, evict LRU item
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU()
    }

    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttl,
      size: 1, // Could be more sophisticated (JSON.stringify(value).length)
    }

    this.cache.set(key, entry)
    this.accessCounter++
    this.accessOrder.set(key, this.accessCounter)

    if (!this.cache.has(key)) {
      this.stats.size++
    }

    logger.debug({ message: 'Cache set', key: key.slice(0, 16), ttlMs: ttl })
  }

  /**
   * Evict the least recently used item
   */
  private evictLRU(): void {
    let oldestKey: string | undefined
    let oldestAccess = Infinity

    for (const [key, accessTime] of this.accessOrder.entries()) {
      if (accessTime < oldestAccess) {
        oldestAccess = accessTime
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.accessOrder.delete(oldestKey)
      this.stats.evictions++
      this.stats.size--
      logger.debug({ message: 'Cache eviction', key: oldestKey.slice(0, 16) })
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.accessOrder.clear()
    this.stats.size = 0
    logger.info('Cache cleared')
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Clean up expired entries (manual cleanup)
   */
  cleanup(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key)
      this.accessOrder.delete(key)
      this.stats.size--
    }

    if (expiredKeys.length > 0) {
      logger.debug({ message: 'Cache cleanup', expiredCount: expiredKeys.length })
    }
  }
}

// Global cache instance
const aiAnalysisCache = new LRUCache<any>(100, 60 * 60 * 1000) // 100 entries, 1 hour TTL

/**
 * Get cached AI analysis result
 *
 * @param transcript - Interview transcript
 * @param context - Additional context (job, candidate info)
 * @returns Cached analysis or undefined
 *
 * @example
 * ```ts
 * const cached = getCachedAnalysis(transcript, { jobTitle: 'Engineer' })
 * if (cached) return cached
 * ```
 */
export function getCachedAnalysis<T>(
  transcript: string,
  context?: Record<string, any>
): T | undefined {
  // Create a deterministic cache key from transcript + context
  const cacheKey = crypto
    .createHash('sha256')
    .update(transcript)
    .update(JSON.stringify(context || {}))
    .digest('hex')

  return aiAnalysisCache.get(cacheKey)
}

/**
 * Set AI analysis result in cache
 *
 * @param transcript - Interview transcript
 * @param context - Additional context
 * @param value - Analysis result to cache
 * @param ttlMs - Optional TTL in milliseconds (default 1 hour)
 *
 * @example
 * ```ts
 * const analysis = await analyzeInterview(transcript, jobContext)
 * setCachedAnalysis(transcript, jobContext, analysis)
 * ```
 */
export function setCachedAnalysis<T>(
  transcript: string,
  context: Record<string, any> | undefined,
  value: T,
  ttlMs?: number
): void {
  // Create the same deterministic cache key
  const cacheKey = crypto
    .createHash('sha256')
    .update(transcript)
    .update(JSON.stringify(context || {}))
    .digest('hex')

  aiAnalysisCache.set(cacheKey, value, ttlMs)
}

/**
 * Clear all cached AI analysis results
 * Useful for testing or manual cache invalidation
 */
export function clearCache(): void {
  aiAnalysisCache.clear()
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  return aiAnalysisCache.getStats()
}

/**
 * Clean up expired cache entries
 * Should be called periodically (e.g., via cron job)
 */
export function cleanupExpiredCache(): void {
  aiAnalysisCache.cleanup()
}

/**
 * Get current cache size
 */
export function getCacheSize(): number {
  return aiAnalysisCache.size()
}

// Automatic periodic cleanup (every 10 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    aiAnalysisCache.cleanup()
  }, 10 * 60 * 1000)
}
