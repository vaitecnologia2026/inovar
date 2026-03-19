// api/auth/login.js — Autenticação de colaboradores
import { query } from '../../lib/db.js'
import { ok, err, serverErr, allowMethods, setCors } from '../../utils/response.js'
import crypto from 'crypto'

function simpleHash(password) {
  return crypto.createHash('sha256').update(password + process.env.JWT_SECRET).digest('hex')
}

export default async function handler(req, res) {
  if (setCors(req, res)) return

  const blocked = allowMethods(req, res, ['POST'])
  if (blocked) return

  try {
    const { login, senha } = req.body || {}
    if (!login || !senha) return err(res, 'Login e senha são obrigatórios')

    const { rows } = await query(
      `SELECT id, nome, login, perfil, avatar, meta, ativo, status, whatsapp, senha_hash
       FROM colaboradores WHERE login=$1`,
      [login]
    )

    const colaborador = rows[0]
    if (!colaborador) return err(res, 'Credenciais inválidas', 401)

    // Verifica senha antes de checar status
    const hashFornecido = simpleHash(senha)
    if (hashFornecido !== colaborador.senha_hash)
      return err(res, 'Credenciais inválidas', 401)

    // Verifica status após senha correta
    if (colaborador.status === 'pendente')
      return err(res, 'Cadastro aguardando aprovação do gestor', 403)

    if (!colaborador.ativo || colaborador.status === 'inativo')
      return err(res, 'Usuário inativo', 401)

    // Remove senha do retorno
    delete colaborador.senha_hash

    // Token simples: base64(id.perfil.timestamp) — em produção usar JWT real
    const tokenPayload = `${colaborador.id}.${colaborador.perfil}.${Date.now()}`
    const token = Buffer.from(tokenPayload).toString('base64')

    return ok(res, { colaborador, token })
  } catch (e) {
    return serverErr(res, e)
  }
}
