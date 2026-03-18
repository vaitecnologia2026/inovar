// api/cupons/[id].js — Detalhar, editar, aprovar, reprovar cupom
import { query } from '../../lib/db.js'
import { aprovarCupom, reprovarCupom } from '../../services/cupomService.js'
import { ok, err, notFound, serverErr, allowMethods, setCors } from '../../utils/response.js'

export default async function handler(req, res) {
  if (setCors(req, res)) return

  const blocked = allowMethods(req, res, ['GET', 'PUT', 'PATCH'])
  if (blocked) return

  const id = req.query.id
  if (!id || isNaN(id)) return err(res, 'ID inválido')

  try {
    // ── GET — detalhes do cupom ─────────────────────────
    if (req.method === 'GET') {
      const { rows: [cupom] } = await query(
        `SELECT c.*, col.nome AS vendedor_nome, a.nome AS aprovador_nome
         FROM cupons c
         JOIN colaboradores col ON col.id=c.vendedor_id
         LEFT JOIN colaboradores a ON a.id=c.aprovado_por
         WHERE c.id=$1`,
        [id]
      )
      if (!cupom) return notFound(res, 'Cupom não encontrado')

      const { rows: logs } = await query(
        `SELECT l.*, u.nome AS usuario_nome
         FROM logs_cupom l
         LEFT JOIN colaboradores u ON u.id=l.usuario_id
         WHERE l.cupom_id=$1
         ORDER BY l.criado_em DESC`,
        [id]
      )

      return ok(res, { cupom, logs })
    }

    // ── PUT — editar dados do cupom (admin) ─────────────
    if (req.method === 'PUT') {
      const { clienteNome, clienteTel, placa, origem, obs, status } = req.body || {}

      const allowed = ['aguard_aprovacao','aprovado','reprovado']
      if (status && !allowed.includes(status))
        return err(res, 'Status inválido')

      const { rows: [updated] } = await query(
        `UPDATE cupons SET
           cliente_nome = COALESCE($1, cliente_nome),
           cliente_tel  = COALESCE($2, cliente_tel),
           placa        = COALESCE($3, placa),
           origem       = COALESCE($4, origem),
           obs          = COALESCE($5, obs),
           status       = COALESCE($6, status)
         WHERE id=$7
         RETURNING *`,
        [clienteNome, clienteTel, placa, origem, obs, status, id]
      )
      if (!updated) return notFound(res, 'Cupom não encontrado')
      return ok(res, { cupom: updated })
    }

    // ── PATCH — ação: aprovar ou reprovar ───────────────
    if (req.method === 'PATCH') {
      const { acao, adminId } = req.body || {}
      if (!adminId) return err(res, 'adminId é obrigatório')

      if (acao === 'aprovar') {
        const result = await aprovarCupom(Number(id), adminId)
        return ok(res, result)
      }

      if (acao === 'reprovar') {
        const cupom = await reprovarCupom(Number(id), adminId)
        return ok(res, { cupom })
      }

      return err(res, 'Ação inválida. Use "aprovar" ou "reprovar"')
    }
  } catch (e) {
    if (e.message.includes('não encontrado')) return notFound(res, e.message)
    return serverErr(res, e)
  }
}