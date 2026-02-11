import { describe, it, expect } from 'vitest'
import { escapeLikePattern } from '@/lib/utils/sql-escape'

describe('escapeLikePattern', () => {
  it('should escape percent signs', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%')
  })

  it('should escape underscores', () => {
    expect(escapeLikePattern('user_name')).toBe('user\\_name')
  })

  it('should escape backslashes', () => {
    expect(escapeLikePattern('path\\file')).toBe('path\\\\file')
  })

  it('should escape multiple special characters', () => {
    expect(escapeLikePattern('100% of_all\\')).toBe('100\\% of\\_all\\\\')
  })

  it('should leave normal strings unchanged', () => {
    expect(escapeLikePattern('John Smith')).toBe('John Smith')
  })

  it('should handle empty string', () => {
    expect(escapeLikePattern('')).toBe('')
  })

  it('should escape multiple percent signs', () => {
    expect(escapeLikePattern('%%test%%')).toBe('\\%\\%test\\%\\%')
  })

  it('should escape multiple underscores', () => {
    expect(escapeLikePattern('__test__')).toBe('\\_\\_test\\_\\_')
  })

  it('should handle mixed special characters', () => {
    expect(escapeLikePattern('test_%\\value')).toBe('test\\_\\%\\\\value')
  })

  it('should not affect alphanumeric characters', () => {
    expect(escapeLikePattern('abc123XYZ')).toBe('abc123XYZ')
  })

  it('should not affect spaces and common punctuation', () => {
    expect(escapeLikePattern('Hello, World! 123')).toBe('Hello, World! 123')
  })

  it('should escape LIKE wildcards in realistic search scenarios', () => {
    // User searching for "50% discount"
    expect(escapeLikePattern('50% discount')).toBe('50\\% discount')

    // User searching for "test_user"
    expect(escapeLikePattern('test_user')).toBe('test\\_user')

    // User searching for file paths
    expect(escapeLikePattern('C:\\Users\\Admin')).toBe('C:\\\\Users\\\\Admin')
  })
})
