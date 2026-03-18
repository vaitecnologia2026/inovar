// api/dashboard.js — Estatísticas consolidadas para o painel admin
import { query } from '../lib/db.js'
import { ok, serverErr, allowMethods } from '../utils/response.js'

export default async function handler(req, res) {
  const blocked = allowMethods(req, res, ['GET'])
  if (blocked) return

  const mes = req.query.mes ||
    `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`

  try {
    const [totais, ranking, indStats, cobrStats] = await Promise.all([
      // Totais do mês
      query(`
        SELECT
          COUNT(*) FILTER (WHERE mes=$1)                         AS total_mes,
          COUNT(*) FILTER (WHERE status='aprovado' AND mes=$1)  AS aprovados,
          COUNT(*) FILTER (WHERE status='aguard_aprovacao')      AS aguardando,
          COUNT(*) FILTER (WHERE status='reprovado' AND mes=$1) AS reprovados,
          (SELECT COUNT(*) FROM colaboradores WHERE perfil='vendedor' AND ativo=true) AS consultores_ativos
        FROM cupons
      `, [mes]),

      // Ranking de consultores
      query(`
        SELECT
          c.id, c.nome, c.avatar, c.meta,
          COUNT(cu.id) FILTER (WHERE cu.mes=$1)                        AS total,
          COUNT(cu.id) FILTER (WHERE cu.status='aprovado' AND cu.mes=$1) AS aprovados
        FROM colaboradores c
        LEFT JOIN cupons cu ON cu.vendedor_id=c.id
        WHERE c.perfil='vendedor' AND c.ativo=true
        GROUP BY c.id, c.nome, c.avatar, c.meta
        ORDER BY total DESC
      `, [mes]),

      // Indicações premiadas
      query(`
        SELECT
          COUNT(*) FILTER (WHERE mes=$1)              AS total_mes,
          COUNT(*) FILTER (WHERE status='aguardando') AS aguardando,
          COUNT(*) FILTER (WHERE status='validado')   AS validados
        FROM indicacoes_premiadas
      `, [mes]),

      // Cobranças
      query(`
        SELECT
          SUM(valor) FILTER (WHERE status='pendente') AS a_receber,
          SUM(valor) FILTER (WHERE status='pago')     AS recebido
        FROM cobrancas
      `),
    ])

    return ok(res, {
      mes,
      totais:  totais.rows[0],
      ranking: ranking.rows,
      indicacoes: indStats.rows[0],
      cobrancas: cobrStats.rows[0],
    })
  } catch (e) {
    return serverErr(res, e)
  }
}
