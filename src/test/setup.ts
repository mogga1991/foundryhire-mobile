// Global test setup
// Mock environment variables
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
process.env.CRON_SECRET = 'test-cron-secret'
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret-1234567890' // Required by env.ts validation

// Ensure no real database connections are made in tests
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
