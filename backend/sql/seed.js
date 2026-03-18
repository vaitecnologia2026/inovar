// sql/seed.js — Cria usuário admin inicial no banco
// Executar: node sql/seed.js
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

import pkg from 'pg'
const { Pool } = pkg
import crypto from 'crypto'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Carrega .env manualmente (sem dotenv)
try {
  const env = readFileSync(join(__dirname, '../.env'), 'utf8')
  env.split('\n').forEach(line => {
    const [key, ...val] = line.split('=')
    if (key && !key.startsWith('#')) process.env[key.trim()] = val.join('=').trim()
  })
} catch {}

const db = new Pool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT) || 5433,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  ssl:      false,
})

function hashSenha(senha) {
  return crypto.createHash('sha256').update(senha + (process.env.JWT_SECRET || 'inovar')).digest('hex')
}

async function seed() {
  console.log('🔧 Executando seed INOVAR...\n')

  try {
    // Roda schema
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
    await db.query(schema)
    console.log('✅ Schema criado/atualizado')

    // Admin inicial
    const adminSenha = 'admin123'
    const adminHash  = hashSenha(adminSenha)

    const { rowCount } = await db.query(
      `INSERT INTO colaboradores (nome, login, senha_hash, perfil, avatar, meta)
       VALUES ('Gestor INOVAR', 'gestor@inovar.com.br', $1, 'admin', 'G', 0)
       ON CONFLICT (login) DO NOTHING`,
      [adminHash]
    )

    if (rowCount > 0) {
      console.log('✅ Admin criado:')
      console.log('   Login: gestor@inovar.com.br')
      console.log('   Senha: admin123')
      console.log('   ⚠️  Troque a senha após o primeiro login!')
    } else {
      console.log('ℹ️  Admin já existe — sem alterações')
    }

    // Consultor de exemplo
    await db.query(
      `INSERT INTO colaboradores (nome, login, senha_hash, perfil, avatar, meta)
       VALUES ('Carlos Consultor', 'carlos@inovar.com.br', $1, 'vendedor', 'C', 50)
       ON CONFLICT (login) DO NOTHING`,
      [hashSenha('consultor123')]
    )
    console.log('✅ Consultor de exemplo criado: carlos@inovar.com.br / consultor123')

    console.log('\n🚀 Seed concluído com sucesso!')
  } catch (e) {
    console.error('❌ Erro no seed:', e.message)
    process.exit(1)
  } finally {
    await db.end()
  }
}

seed()
