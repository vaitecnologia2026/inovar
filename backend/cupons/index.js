// api/cupons/index.js — Listar e criar cupons
import { query } from '../../lib/db.js'
import { criarCupom } from '../../services/cupomService.js'
import { ok, created, err, serverErr, allowMethods, setCors } from '../../utils/response.js'

export default async function handler(req, res) {
  if (setCors(req, res)) return

  const blocked = allowMethods(req, res, ['GET', 'POST'])
  if (blocked) return

  try {
    // ── GET — listar cupons com filtros ─────────────────
    if (req.method === 'GET') {
      const { mes, vendedor_id, status, search, page = 1, limit = 50 } = req.query
      const offset = (Number(page) - 1) * Number(limit)

      const conditions = []
      const params = []
      let i = 1

      if (mes)         { conditions.push(`c.mes=$${i++}`)           ; params.push(mes) }
      if (vendedor_id) { conditions.push(`c.vendedor_id=$${i++}`)   ; params.push(vendedor_id) }
      if (status)      { conditions.push(`c.status=$${i++}`)        ; params.push(status) }
      if (search) {
        conditions.push(
          `(c.cliente_nome ILIKE $${i} OR c.codigo ILIKE $${i} OR c.placa ILIKE $${i} OR c.cliente_tel ILIKE $${i})`
        )
        params.push(`%${search}%`); i++
      }

      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

      const sql = `
        SELECT
          c.*,
          col.nome AS vendedor_nome,
          col.avatar AS vendedor_avatar,
          a.nome AS aprovador_nome
        FROM cupons c
        JOIN colaboradores col ON col.id = c.vendedor_id
        LEFT JOIN colaboradores a ON a.id = c.aprovado_por
        ${where}
        ORDER BY c.criado_em DESC
        LIMIT $${i++} OFFSET $${i++}
      `
      params.push(Number(limit), offset)

      const countSql = `SELECT COUNT(*) FROM cupons c ${where}`
      const [{ rows }, { rows: [{ count }] }] = await Promise.all([
        query(sql, params),
        query(countSql, params.slice(0, -2)),
      ])

      return ok(res, { cupons: rows, total: Number(count), page: Number(page), limit: Number(limit) })
    }

    // ── POST — criar novo cupom ─────────────────────────
    if (req.method === 'POST') {
      const { clienteNome, clienteTel, placa, origem, vendedorId, obs } = req.body || {}

      if (!clienteNome) return err(res, 'Nome do cliente é obrigatório')
      if (!clienteTel)  return err(res, 'WhatsApp do cliente é obrigatório')
      if (!placa)       return err(res, 'Placa do veículo é obrigatória')
      if (!vendedorId)  return err(res, 'ID do vendedor é obrigatório')

      const cupom = await criarCupom({ clienteNome, clienteTel, placa, origem, vendedorId, obs })
      return created(res, { cupom })
    }
  } catch (e) {
    return serverErr(res, e)
  }
}