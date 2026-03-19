// services/relatorioService.js — Geração e envio do relatório automático
import { query } from '../lib/db.js'
import { enviarRelatorio } from './whatsappService.js'

export async function gerarRelatorio() {
  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`
  const dataHoje = hoje.toISOString().split('T')[0]

  // Dados do relatório
  const [{ rows: [totais] }, { rows: ranking }, { rows: pendentes }] = await Promise.all([
    query(`
      SELECT
        COUNT(*) FILTER (WHERE mes=$1) as total_mes,
        COUNT(*) FILTER (WHERE status='aprovado' AND mes=$1) as aprovados,
        COUNT(*) FILTER (WHERE status='aguard_aprovacao') as pendentes,
        COUNT(*) FILTER (WHERE DATE(criado_em)=CURRENT_DATE) as hoje
      FROM cupons
    `, [mesAtual]),
    query(`
      SELECT c.nome, COUNT(cu.id) as total, COUNT(cu.id) FILTER (WHERE cu.status='aprovado') as confirmados
      FROM colaboradores c
      LEFT JOIN cupons cu ON cu.vendedor_id=c.id AND cu.mes=$1
      WHERE c.perfil='vendedor' AND c.ativo=true
      GROUP BY c.id, c.nome
      ORDER BY total DESC
      LIMIT 5
    `, [mesAtual]),
    query(`SELECT COUNT(*) as total FROM cupons WHERE status='aguard_aprovacao'`),
  ])

  // Monta relatório no padrão VAI
  const top = ranking.slice(0,3).map((r,i) =>
    `${['🥇','🥈','🥉'][i]} ${r.nome.split(' ')[0]}: *${r.total}* cupons`
  ).join('\n')

  const progresso = ranking.map(r => {
    const pct = r.total > 0 ? Math.round((r.confirmados / r.total) * 100) : 0
    const bar = '█'.repeat(Math.round(pct/10)) + '░'.repeat(10-Math.round(pct/10))
    return `${r.nome.split(' ')[0]}: ${bar} ${pct}%`
  }).join('\n')

  const corpo = `🔴 *INOVAR PROTEÇÃO VEICULAR*
📊 *Relatório Diário — ${dataHoje.split('-').reverse().join('/')}*
━━━━━━━━━━━━━━━━━━━━━━

📈 *RESUMO DO DIA*
• Novos cadastros: *${totais.hoje}*
• Total no mês: *${totais.total_mes}*
• ✅ Aprovados: *${totais.aprovados}*
• ⏳ Aguardando aprovação: *${pendentes[0].total}*

🏆 *TOP CONSULTORES — ${mesAtual.split('-').reverse().join('/')}*
${top || 'Nenhum registro ainda'}

📊 *TAXA DE CONFIRMAÇÃO*
${progresso || '—'}

━━━━━━━━━━━━━━━━━━━━━━
_INOVAR Proteção Veicular · Sistema VAI_`

  return { corpo, totais, ranking }
}

export async function enviarRelatorioParaEquipe() {
  const { rows } = await query(`SELECT chave, valor FROM config_sistema`)
  const cfg = Object.fromEntries(rows.map(r => [r.chave, r.valor]))

  // Usa relatorio_numero como fonte principal do número
  const numero = cfg.relatorio_numero || cfg.notif_numero_equipe || ''

  if (!numero) return { enviado: false, motivo: 'sem número configurado' }

  const { corpo } = await gerarRelatorio()

  await enviarRelatorio({
    numero,
    nome: 'Equipe INOVAR',
    corpo,
  })

  return { enviado: true, timestamp: new Date().toISOString() }
}
