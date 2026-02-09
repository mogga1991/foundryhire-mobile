# Logging Guide

## Overview

This project uses [Pino](https://github.com/pinojs/pino) for production-grade logging. Pino is a fast, low-overhead logging library designed for Node.js applications.

## Setup

The logger is configured in `src/lib/logger.ts` with the following features:

- **Development**: Pretty-printed, colorized logs with timestamps
- **Production**: Structured JSON logs for easy parsing and analysis
- **Log Levels**: Configurable via `LOG_LEVEL` environment variable

## Usage

### API Routes (Server-Side)

For API routes and server-side code, always use the logger instead of console statements:

```typescript
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:your-route')

// Info logging
logger.info({ userId: user.id }, 'User logged in successfully')

// Error logging
logger.error({ error, userId: user.id }, 'Failed to process request')

// Debug logging (only shown in development or if LOG_LEVEL=debug)
logger.debug({ data }, 'Processing data')

// Warning logging
logger.warn({ threshold: 100, current: 150 }, 'Rate limit approaching')
```

### Client Components

For client-side components, consider whether logging is necessary:

1. **Remove debug logs**: Most console.log statements used during development should be removed
2. **Conditional logging**: For important client-side events, use conditional logging:

```typescript
if (process.env.NODE_ENV !== 'production') {
  console.log('Debug info:', data)
}
```

3. **Error tracking**: For production errors, consider using a service like Sentry instead

### Library Code

For utility functions and library code:

- **Server-side utilities**: Use the logger
- **Client-side utilities**: Remove or conditionally log
- **Shared utilities**: Check the environment before logging

## Log Levels

- `fatal`: Application-stopping errors
- `error`: Error conditions that need attention
- `warn`: Warning conditions (e.g., deprecated API usage, rate limits)
- `info`: Important application events (e.g., user actions, API calls)
- `debug`: Detailed debugging information
- `trace`: Very detailed debugging information

## Best Practices

1. **Include context**: Always include relevant context in your log messages

```typescript
// Good
logger.error({ error, userId, jobId }, 'Failed to create job')

// Bad
logger.error(error)
```

2. **Use structured logging**: Pass objects as the first parameter, message as the second

```typescript
// Good
logger.info({ userId, action: 'login' }, 'User action')

// Bad
logger.info(`User ${userId} performed action login`)
```

3. **Don't log sensitive data**: Never log passwords, tokens, or PII

```typescript
// Bad
logger.info({ password }, 'User credentials')

// Good
logger.info({ userId }, 'Authentication attempt')
```

4. **Choose appropriate levels**: Use the right log level for each situation
   - Errors that need immediate attention: `error`
   - Important business events: `info`
   - Development debugging: `debug`

## Migration from console statements

Run the migration helper script to identify console statements:

```bash
./scripts/migrate-to-logger.sh
```

Then manually replace them following these patterns:

- `console.error()` → `logger.error()`
- `console.log()` → `logger.info()` or `logger.debug()`
- `console.warn()` → `logger.warn()`

## Environment Variables

- `LOG_LEVEL`: Set the minimum log level (default: `info` in production, `debug` in development)
  - Options: `fatal`, `error`, `warn`, `info`, `debug`, `trace`

## Future Improvements

Consider integrating with:

- **Log aggregation**: Ship logs to services like Datadog, LogDNA, or CloudWatch
- **Error tracking**: Integrate Sentry or similar for error monitoring
- **Performance monitoring**: Add request timing and performance logs
