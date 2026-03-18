// api/colaboradores/index.js — Gestão de colaboradores
import { query } from '../../lib/db.js'
import { ok, created, err, serverErr, allowMethods, setCors } from '../../utils/response.js'
import crypto from 'crypto'

function hashSenha(senha) {
  return crypto.createHash('sha256').update(senha + process.env.JWT_SECRET).digest('hex')
}

export default async function handler(req, res) {
  if (setCors(req, res)) return

  const blocked = allowMethods(req, res, ['GET', 'POST', 'PUT'])
  if (blocked) return

  try {
    // ── GET — listar colaboradores ──────────────────────
    if (req.method === 'GET') {
      const { rows } = await query(
        `SELECT id, nome, login, perfil, avatar, meta, ativo, criado_em
         FROM colaboradores
         ORDER BY ativo DESC, nome`
      )
      return ok(res, { colaboradores: rows })
    }

    // ── POST — criar colaborador ────────────────────────
    if (req.method === 'POST') {
      const { nome, login, senha, perfil = 'vendedor', meta = 0, avatar } = req.body || {}

      if (!nome)  return err(res, 'Nome é obrigatório')
      if (!login) return err(res, 'Login é obrigatório')
      if (!senha || senha.length < 6) return err(res, 'Senha precisa ter mínimo 6 caracteres')

      const perfisValidos = ['admin','supervisor','gerente','vendedor','retencao','site','backoffice']
      if (!perfisValidos.includes(perfil)) return err(res, 'Perfil inválido')

      // Verifica duplicidade
      const { rows: dup } = await query('SELECT id FROM colaboradores WHERE login=$1', [login])
      if (dup.length) return err(res, 'Login já está em uso', 409)

      const av = (avatar || nome[0] || '?').toUpperCase().charAt(0)

      const { rows: [collab] } = await query(
        `INSERT INTO colaboradores (nome, login, senha_hash, perfil, meta, avatar)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, nome, login, perfil, avatar, meta, ativo, criado_em`,
        [nome, login, hashSenha(senha), perfil, meta, av]
      )
      return created(res, { colaborador: collab })
    }

    // ── PUT — atualizar colaborador ─────────────────────
    if (req.method === 'PUT') {
      const { id, nome, login, senha, perfil, meta, avatar, ativo } = req.body || {}
      if (!id) return err(res, 'ID é obrigatório')

      let senhaClause = ''
      const params = [nome, login, perfil, meta, avatar, ativo !== undefined ? ativo : true, id]
      if (senha && senha.length >= 6) {
        senhaClause = ', senha_hash=$8'
        params.push(hashSenha(senha))
      }

      const { rows: [updated] } = await query(
        `UPDATE colaboradores SET
           nome=$1, login=$2, perfil=$3, meta=$4, avatar=$5, ativo=$6
           ${senhaClause}
         WHERE id=$7
         RETURNING id, nome, login, perfil, avatar, meta, ativo, criado_em`,
        params
      )
      if (!updated) return err(res, 'Colaborador não encontrado', 404)
      return ok(res, { colaborador: updated })
    }
  } catch (e) {
    return serverErr(res, e)
  }
}
