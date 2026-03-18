// api/whatsapp/origens.js — Origens de indicação
import { query } from '../../lib/db.js'
import { ok, created, err, serverErr, allowMethods, setCors } from '../../utils/response.js'

export default async function handler(req, res) {
  if (setCors(req, res)) return

  const blocked = allowMethods(req, res, ['GET', 'POST', 'PUT', 'DELETE'])
  if (blocked) return

  try {
    if (req.method === 'GET') {
      const apenasAtivos = req.query.ativo === 'true'
      const sql = apenasAtivos
        ? `SELECT * FROM origens WHERE ativo=true ORDER BY nome`
        : `SELECT * FROM origens ORDER BY ativo DESC, nome`
      const { rows } = await query(sql)
      return ok(res, { origens: rows })
    }

    if (req.method === 'POST') {
      const { nome, icone = '🏷️' } = req.body || {}
      if (!nome) return err(res, 'Nome é obrigatório')
      const { rows: dup } = await query('SELECT id FROM origens WHERE LOWER(nome)=LOWER($1)', [nome])
      if (dup.length) return err(res, 'Origem já cadastrada', 409)
      const { rows: [origem] } = await query(
        `INSERT INTO origens (nome, icone) VALUES ($1,$2) RETURNING *`,
        [nome, icone]
      )
      return created(res, { origem })
    }

    if (req.method === 'PUT') {
      const { id, nome, icone, ativo } = req.body || {}
      if (!id) return err(res, 'ID é obrigatório')
      const { rows: [updated] } = await query(
        `UPDATE origens SET
           nome  = COALESCE($1, nome),
           icone = COALESCE($2, icone),
           ativo = COALESCE($3, ativo)
         WHERE id=$4 RETURNING *`,
        [nome, icone, ativo, id]
      )
      if (!updated) return err(res, 'Origem não encontrada', 404)
      return ok(res, { origem: updated })
    }

    if (req.method === 'DELETE') {
      const { id } = req.query
      if (!id) return err(res, 'ID é obrigatório')
      // Só permite excluir se não houver cupons com essa origem
      const { rows: [{ total }] } = await query(
        `SELECT COUNT(*) AS total FROM cupons WHERE origem=(SELECT nome FROM origens WHERE id=$1)`,
        [id]
      )
      if (Number(total) > 0) return err(res, 'Origem em uso — desative em vez de excluir', 409)
      await query('DELETE FROM origens WHERE id=$1', [id])
      return ok(res, { excluido: true })
    }
  } catch (e) {
    return serverErr(res, e)
  }
}
