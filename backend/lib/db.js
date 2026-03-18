// lib/db.js — Conexão PostgreSQL reutilizável (stateless, compatível Vercel)
import pkg from 'pg'
const { Pool } = pkg

let _pool = null

export function getDb() {
  if (!_pool) {
    _pool = new Pool({
      host:     process.env.DB_HOST,
      port:     Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user:     process.env.DB_USER,
      password: process.env.DB_PASS,
      ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max:      10,
      idleTimeoutMillis: 30000,
    })
    _pool.on('error', (err) => console.error('[DB] Pool error:', err.message))
  }
  return _pool
}

// Wrapper para queries com log de erros
export async function query(sql, params = []) {
  const db = getDb()
  try {
    const result = await db.query(sql, params)
    return result
  } catch (err) {
    console.error('[DB] Query error:', err.message, '|', sql.substring(0, 80))
    throw err
  }
}
