import pino from 'pino'

// Create logger instance based on environment
const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
  ...(process.env.NODE_ENV === 'production' && {
    formatters: {
      level: (label) => {
        return { level: label }
      },
    },
  }),
})

// Helper function to create child loggers with context
export function createLogger(context: string) {
  return logger.child({ context })
}

// Export default logger
export default logger
