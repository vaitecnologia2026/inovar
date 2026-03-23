// api/indicacoes/index.js — Indicações premiadas
import { query } from '../../lib/db.js'
import { ok, created, err, serverErr, allowMethods, setCors } from '../../utils/response.js'

export default async function handler(req, res) {
  if (setCors(req, res)) return

  const blocked = allowMethods(req, res, ['GET', 'POST', 'PATCH'])
  if (blocked) return

  try {
    // ── GET — listar indicações ─────────────────────────
    if (req.method === 'GET') {
      const { mes, vendedor_id, status } = req.query

      const conditions = []
      const params = []
      let i = 1
      if (mes)         { conditions.push(`ip.mes=$${i++}`)         ; params.push(mes) }
      if (vendedor_id) { conditions.push(`ip.vendedor_id=$${i++}`) ; params.push(vendedor_id) }
      if (status)      { conditions.push(`ip.status=$${i++}`)      ; params.push(status) }

      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

      const { rows: indicacoes } = await query(
        `SELECT ip.*, col.nome AS vendedor_nome
         FROM indicacoes_premiadas ip
         JOIN colaboradores col ON col.id=ip.vendedor_id
         ${where}
         ORDER BY ip.criado_em DESC`,
        params
      )

      // Busca indicados de cada indicação
      if (indicacoes.length) {
        const ids = indicacoes.map(i => i.id)
        const { rows: indicados } = await query(
          `SELECT * FROM indicados WHERE indicacao_id = ANY($1) ORDER BY ordem`,
          [ids]
        )
        const mapInd = {}
        indicados.forEach(ind => {
          if (!mapInd[ind.indicacao_id]) mapInd[ind.indicacao_id] = []
          mapInd[ind.indicacao_id].push(ind)
        })
        indicacoes.forEach(i => { i.indicados = mapInd[i.id] || [] })
      }

      return ok(res, { indicacoes })
    }

    // ── POST — criar indicação premiada ─────────────────
    if (req.method === 'POST') {
      const { vendedorId, indNome, indPlaca, indTel, indicados = [], obs = '' } = req.body || {}

      if (!vendedorId) return err(res, 'vendedorId é obrigatório')
      if (!indNome)    return err(res, 'Nome do indicador é obrigatório')
      if (!indPlaca)   return err(res, 'Placa do indicador é obrigatória')
      if (!indTel)     return err(res, 'WhatsApp do indicador é obrigatório')
      if (!indicados.length) return err(res, 'Informe pelo menos 1 indicado')

      // Verifica duplicidade de indicador no mês
      const mes = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`
      const { rows: dup } = await query(
        `SELECT id FROM indicacoes_premiadas WHERE ind_tel=$1 AND mes=$2`,
        [indTel, mes]
      )
      if (dup.length) return err(res, 'Este indicador já possui indicação registrada neste mês', 409)

      // Verifica indicados duplicados
      const tels = indicados.map(i => i.tel)
      const { rows: dupInd } = await query(
        `SELECT ind.tel FROM indicados ind
         JOIN indicacoes_premiadas ip ON ip.id=ind.indicacao_id
         WHERE ind.tel = ANY($1) AND ip.mes=$2`,
        [tels, mes]
      )
      if (dupInd.length) {
        return err(res, `Indicados já registrados este mês: ${dupInd.map(d => d.tel).join(', ')}`, 409)
      }

      // Gera código
      const ano = new Date().getFullYear()
      const { rows: [{ total }] } = await query(
        `SELECT COUNT(*) as total FROM indicacoes_premiadas WHERE EXTRACT(YEAR FROM criado_em)=$1`,
        [ano]
      )
      const codigo = `IND-${ano}-${String(Number(total)+1001).padStart(4,'0')}`

      const { rows: [indicacao] } = await query(
        `INSERT INTO indicacoes_premiadas (codigo, vendedor_id, ind_nome, ind_placa, ind_tel, obs, mes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [codigo, vendedorId, indNome, indPlaca, indTel, obs, mes]
      )

      // Insere indicados
      for (let idx = 0; idx < indicados.length && idx < 3; idx++) {
        const ind = indicados[idx]
        await query(
          `INSERT INTO indicados (indicacao_id, nome, tel, ordem) VALUES ($1,$2,$3,$4)`,
          [indicacao.id, ind.nome, ind.tel, idx + 1]
        )
      }

      // Gera cobrança R$1,00
      await query(
        `INSERT INTO cobrancas (vendedor_id, valor, descricao, indicacao_id, mes)
         VALUES ($1, 1.00, $2, $3, $4)`,
        [vendedorId, `Indicação Premiada ${codigo}`, indicacao.id, mes]
      )

      return created(res, { indicacao, codigo })
    }

    // ── PATCH — validar ou reprovar ─────────────────────
if (req.method === 'PATCH') {
  const { id, acao, adminId, obsReprovacao = '' } = req.body || {}
  if (!id || !acao || !adminId) return err(res, 'id, acao e adminId são obrigatórios')

  if (!['validar','reprovar'].includes(acao)) return err(res, 'Ação inválida')

  const status = acao === 'validar' ? 'validado' : 'reprovado'
  const { rows: [updated] } = await query(
    `UPDATE indicacoes_premiadas SET status=$1, validado_por=$2, validado_em=NOW(),
      obs_reprovacao=CASE WHEN $1='reprovado' THEN $4 ELSE obs_reprovacao END
     WHERE id=$3 RETURNING *`,
    [status, adminId, id, obsReprovacao]
  )
  if (!updated) return err(res, 'Indicação não encontrada', 404)
  return ok(res, { indicacao: updated })
}
  } catch (e) {
    return serverErr(res, e)
  }
}
