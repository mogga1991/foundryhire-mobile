import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

let dbInstance: NeonHttpDatabase<typeof schema> | null = null

function getDb(): NeonHttpDatabase<typeof schema> {
  if (!dbInstance) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    const sql = neon(process.env.DATABASE_URL)
    dbInstance = drizzle(sql, { schema })
  }
  return dbInstance
}

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop) {
    const database = getDb()
    const value = database[prop as keyof typeof database]
    return typeof value === 'function' ? value.bind(database) : value
  }
})
