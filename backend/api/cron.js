// api/whatsapp/cron.js — Rota executada pelo Vercel Cron (substitui node-cron)
// Configurar no vercel.json: "schedule": "0 8 * * *" (todo dia às 08:00)
import { query } from '../../lib/db.js'
import { enviarRelatorioParaEquipe } from '../../services/relatorioService.js'
import { enviarFollowUp } from '../../services/whatsappService.js'
import { ok, err, serverErr, setCors } from '../../utils/response.js'

export default async function handler(req, res) {
  if (setCors(req, res)) return

  // Proteção: só permite GET e POST e valida token secreto
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).end()
  }

  const token = req.headers['x-cron-secret'] || req.query.secret
  if (token !== process.env.CRON_SECRET) {
    return err(res, 'Não autorizado', 401)
  }

  const log = []
  const errors = []

  try {
    // ── 1. RELATÓRIO AUTOMÁTICO ─────────────────────────
    try {
      const { rows: [cfg] } = await query(
        `SELECT valor FROM config_sistema WHERE chave='relatorio_frequencia'`
      )
      const freq = cfg?.valor || 'diario'
      const deveEnviar = freq === 'diario' // simplificado — expandir para semanal/mensal
      if (deveEnviar) {
        const resultado = await enviarRelatorioParaEquipe()
        log.push({ tarefa: 'relatorio', resultado })
      }
    } catch (e) {
      errors.push({ tarefa: 'relatorio', erro: e.message })
    }

    // ── 2. FOLLOW-UP DA JORNADA ─────────────────────────
    try {
      const { rows: [cfg1] } = await query(
        `SELECT valor FROM config_sistema WHERE chave='jornada_ativo'`
      )
      if (cfg1?.valor === 'true') {
        // Busca configs da jornada
        const { rows: configs } = await query(
          `SELECT chave, valor FROM config_sistema WHERE categoria='jornada'`
        )
        const jornada = configs.reduce((a, r) => { a[r.chave] = r.valor; return a }, {})

        const f1Dias = Number(jornada.jornada_followup1_dias || 3)
        const f2Dias = Number(jornada.jornada_followup2_dias || 7)

        // Follow-up 1: cupons aprovados há N dias sem follow-up enviado
        const { rows: f1Cupons } = await query(`
          SELECT c.* FROM cupons c
          WHERE c.status='aprovado'
            AND c.whatsapp_enviado=true
            AND DATE(c.aprovado_em) = CURRENT_DATE - INTERVAL '${f1Dias} days'
            AND NOT EXISTS (
              SELECT 1 FROM logs_cupom l
              WHERE l.cupom_id=c.id AND l.acao='followup1'
            )
        `)

        for (const cupom of f1Cupons) {
          try {
            await enviarFollowUp({
              numero:   cupom.cliente_tel,
              nome:     cupom.cliente_nome,
              codigo:   cupom.codigo,
              mensagem: jornada.jornada_followup1_msg || 'Olá {nome}, seu cupom {codigo} ainda está válido!',
            })
            await query(
              `INSERT INTO logs_cupom (cupom_id, acao) VALUES ($1,'followup1')`,
              [cupom.id]
            )
          } catch (e) {
            errors.push({ tarefa: 'followup1', cupomId: cupom.id, erro: e.message })
          }
        }

        log.push({ tarefa: 'followup1', enviados: f1Cupons.length })

        // Follow-up 2
        const { rows: f2Cupons } = await query(`
          SELECT c.* FROM cupons c
          WHERE c.status='aprovado'
            AND c.whatsapp_enviado=true
            AND DATE(c.aprovado_em) = CURRENT_DATE - INTERVAL '${f2Dias} days'
            AND NOT EXISTS (
              SELECT 1 FROM logs_cupom l
              WHERE l.cupom_id=c.id AND l.acao='followup2'
            )
        `)

        for (const cupom of f2Cupons) {
          try {
            await enviarFollowUp({
              numero:   cupom.cliente_tel,
              nome:     cupom.cliente_nome,
              codigo:   cupom.codigo,
              mensagem: jornada.jornada_followup2_msg || 'Último lembrete! Cupom: {codigo}',
            })
            await query(
              `INSERT INTO logs_cupom (cupom_id, acao) VALUES ($1,'followup2')`,
              [cupom.id]
            )
          } catch (e) {
            errors.push({ tarefa: 'followup2', cupomId: cupom.id, erro: e.message })
          }
        }

        log.push({ tarefa: 'followup2', enviados: f2Cupons.length })
      }
    } catch (e) {
      errors.push({ tarefa: 'jornada', erro: e.message })
    }

    // ── 3. ALERTA DE META ───────────────────────────────
    try {
      const mes = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`
      const { rows: [cfgAlerta] } = await query(
        `SELECT valor FROM config_sistema WHERE chave='notif_alerta_meta'`
      )
      const pctAlerta = Number(cfgAlerta?.valor || 80)

      const { rows: vendedores } = await query(`
        SELECT c.nome, c.meta, COUNT(cu.id) as total
        FROM colaboradores c
        LEFT JOIN cupons cu ON cu.vendedor_id=c.id AND cu.mes=$1
        WHERE c.perfil='vendedor' AND c.ativo=true AND c.meta>0
        GROUP BY c.id, c.nome, c.meta
        HAVING c.meta > 0
      `, [mes])

      const alertas = vendedores.filter(v => {
        const pct = (Number(v.total) / Number(v.meta)) * 100
        return pct >= pctAlerta && pct < 100
      })

      if (alertas.length) {
        log.push({ tarefa: 'alertas_meta', consultores: alertas.map(a => a.nome) })
      }
    } catch (e) {
      errors.push({ tarefa: 'alertas_meta', erro: e.message })
    }

    return ok(res, {
      cron:    'executado',
      horario: new Date().toISOString(),
      tarefas: log,
      erros:   errors,
    })
  } catch (e) {
    return serverErr(res, e)
  }
}
