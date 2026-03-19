// api/auth/register.js — Auto-cadastro de novo colaborador (pendente até aprovação)
import { query } from '../../lib/db.js'
import { ok, err, serverErr, allowMethods, setCors } from '../../utils/response.js'
import crypto from 'crypto'

function hashSenha(senha) {
  return crypto.createHash('sha256').update(senha + process.env.JWT_SECRET).digest('hex')
}

export default async function handler(req, res) {
  if (setCors(req, res)) return

  const blocked = allowMethods(req, res, ['POST'])
  if (blocked) return

  try {
    const { nome, login, senha, whatsapp } = req.body || {}

    if (!nome)     return err(res, 'Nome é obrigatório')
    if (!login)    return err(res, 'Login é obrigatório')
    if (!senha || senha.length < 6) return err(res, 'Senha precisa ter mínimo 6 caracteres')
    if (!whatsapp) return err(res, 'WhatsApp é obrigatório')

    // Verifica duplicidade de login
    const { rows: dup } = await query('SELECT id FROM colaboradores WHERE login=$1', [login])
    if (dup.length) return err(res, 'Este e-mail já está cadastrado', 409)

    const avatar = nome[0].toUpperCase()

    const { rows: [colaborador] } = await query(
      `INSERT INTO colaboradores (nome, login, senha_hash, perfil, avatar, whatsapp, status, ativo, meta)
       VALUES ($1, $2, $3, 'vendedor', $4, $5, 'pendente', false, 0)
       RETURNING id, nome, login, perfil, avatar, whatsapp, status`,
      [nome, login, hashSenha(senha), avatar, whatsapp]
    )

    return ok(res, {
      mensagem: 'Cadastro realizado! Aguarde a aprovação do gestor.',
      colaborador,
    })
  } catch (e) {
    return serverErr(res, e)
  }
}
