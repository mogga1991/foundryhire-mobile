import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { retryWithBackoff } from '@/lib/utils/retry'

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should return result on first successful attempt', async () => {
    const mockFn = vi.fn().mockResolvedValue('success')

    const resultPromise = retryWithBackoff(mockFn)
    const result = await resultPromise

    expect(result).toBe('success')
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should retry after 1 failure then succeed', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('First attempt failed'))
      .mockResolvedValueOnce('success')

    const resultPromise = retryWithBackoff(mockFn, {
      maxRetries: 3,
      baseDelayMs: 1000,
    })

    // Fast-forward through the delay
    await vi.advanceTimersByTimeAsync(1000)

    const result = await resultPromise

    expect(result).toBe('success')
    expect(mockFn).toHaveBeenCalledTimes(2)
  })

  it('should throw last error when all retries are exhausted', async () => {
    const finalError = new Error('Final attempt failed')
    const mockFn = vi.fn().mockRejectedValue(finalError)

    const resultPromise = retryWithBackoff(mockFn, {
      maxRetries: 2,
      baseDelayMs: 100,
    }).catch((err) => err) // Catch to prevent unhandled rejection warning

    // Fast-forward through all retry delays
    // Attempt 0: immediate
    // Attempt 1: after 100ms (baseDelayMs * 2^0)
    // Attempt 2: after 200ms (baseDelayMs * 2^1)
    await vi.advanceTimersByTimeAsync(100) // First retry
    await vi.advanceTimersByTimeAsync(200) // Second retry

    const result = await resultPromise
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('Final attempt failed')
    expect(mockFn).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it('should use exponential backoff timing', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Always fails'))

    const resultPromise = retryWithBackoff(mockFn, {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 10000,
    }).catch((err) => err) // Catch to prevent unhandled rejection warning

    // Attempt 0: immediate (fails)
    expect(mockFn).toHaveBeenCalledTimes(1)

    // Attempt 1: after 100ms (baseDelayMs * 2^0 = 100ms)
    await vi.advanceTimersByTimeAsync(100)
    expect(mockFn).toHaveBeenCalledTimes(2)

    // Attempt 2: after 200ms (baseDelayMs * 2^1 = 200ms)
    await vi.advanceTimersByTimeAsync(200)
    expect(mockFn).toHaveBeenCalledTimes(3)

    // Attempt 3: after 400ms (baseDelayMs * 2^2 = 400ms)
    await vi.advanceTimersByTimeAsync(400)
    expect(mockFn).toHaveBeenCalledTimes(4)

    const result = await resultPromise
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('Always fails')
  })

  it('should cap delay at maxDelayMs', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Always fails'))

    const resultPromise = retryWithBackoff(mockFn, {
      maxRetries: 5,
      baseDelayMs: 1000,
      maxDelayMs: 3000, // Cap at 3 seconds
    }).catch((err) => err) // Catch to prevent unhandled rejection warning

    // Attempt 0: immediate
    expect(mockFn).toHaveBeenCalledTimes(1)

    // Attempt 1: after 1000ms (1000 * 2^0 = 1000ms)
    await vi.advanceTimersByTimeAsync(1000)
    expect(mockFn).toHaveBeenCalledTimes(2)

    // Attempt 2: after 2000ms (1000 * 2^1 = 2000ms)
    await vi.advanceTimersByTimeAsync(2000)
    expect(mockFn).toHaveBeenCalledTimes(3)

    // Attempt 3: after 3000ms (capped, would be 4000ms but maxDelayMs = 3000ms)
    await vi.advanceTimersByTimeAsync(3000)
    expect(mockFn).toHaveBeenCalledTimes(4)

    // Attempt 4: after 3000ms (capped, would be 8000ms but maxDelayMs = 3000ms)
    await vi.advanceTimersByTimeAsync(3000)
    expect(mockFn).toHaveBeenCalledTimes(5)

    // Attempt 5: after 3000ms (capped, would be 16000ms but maxDelayMs = 3000ms)
    await vi.advanceTimersByTimeAsync(3000)
    expect(mockFn).toHaveBeenCalledTimes(6)

    const result = await resultPromise
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('Always fails')
  })

  it('should use default options when none provided', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Always fails'))

    const resultPromise = retryWithBackoff(mockFn).catch((err) => err) // Catch to prevent unhandled rejection warning

    // Default maxRetries = 3, baseDelayMs = 1000
    // Attempt 0: immediate
    expect(mockFn).toHaveBeenCalledTimes(1)

    // Attempt 1: after 1000ms
    await vi.advanceTimersByTimeAsync(1000)
    expect(mockFn).toHaveBeenCalledTimes(2)

    // Attempt 2: after 2000ms
    await vi.advanceTimersByTimeAsync(2000)
    expect(mockFn).toHaveBeenCalledTimes(3)

    // Attempt 3: after 4000ms
    await vi.advanceTimersByTimeAsync(4000)
    expect(mockFn).toHaveBeenCalledTimes(4)

    const result = await resultPromise
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('Always fails')
  })

  it('should convert non-Error thrown values to Error objects', async () => {
    const mockFn = vi.fn().mockRejectedValue('String error')

    await expect(
      retryWithBackoff(mockFn, {
        maxRetries: 0, // No retries for quick test
      })
    ).rejects.toThrow('String error')
  })

  it('should handle async function that throws synchronously', async () => {
    const mockFn = vi.fn().mockImplementation(() => {
      throw new Error('Synchronous error')
    })

    const resultPromise = retryWithBackoff(mockFn, {
      maxRetries: 1,
      baseDelayMs: 100,
    }).catch((err) => err) // Catch to prevent unhandled rejection warning

    await vi.advanceTimersByTimeAsync(100)

    const result = await resultPromise
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('Synchronous error')
    expect(mockFn).toHaveBeenCalledTimes(2) // initial + 1 retry
  })

  it('should succeed after multiple failures', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Attempt 1 failed'))
      .mockRejectedValueOnce(new Error('Attempt 2 failed'))
      .mockResolvedValueOnce('success on third attempt')

    const resultPromise = retryWithBackoff(mockFn, {
      maxRetries: 3,
      baseDelayMs: 100,
    })

    // First retry after 100ms
    await vi.advanceTimersByTimeAsync(100)

    // Second retry after 200ms
    await vi.advanceTimersByTimeAsync(200)

    const result = await resultPromise

    expect(result).toBe('success on third attempt')
    expect(mockFn).toHaveBeenCalledTimes(3)
  })
})
