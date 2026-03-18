// services/cupomService.js — Lógica de negócio de cupons
import { query } from '../lib/db.js'
import { enviarCupom, enviarAprovacao, enviarReprovacao } from './whatsappService.js'

// Gera próximo código de cupom: INV-2026-XXXX
export async function gerarCodigo(prefixo = 'INV') {
  const ano = new Date().getFullYear()
  const { rows } = await query(
    `SELECT COUNT(*) as total FROM cupons WHERE EXTRACT(YEAR FROM criado_em) = $1`,
    [ano]
  )
  const seq = Number(rows[0].total) + 1
  return `${prefixo}-${ano}-${String(seq).padStart(4, '0')}`
}

// Cria um novo cupom no banco com status 'aguard_aprovacao'
export async function criarCupom({ clienteNome, clienteTel, placa, origem, vendedorId, obs = '' }) {
  const config = await getConfig()
  const codigo = await gerarCodigo(config.cupom_prefixo || 'INV')

  const { rows } = await query(
    `INSERT INTO cupons
      (codigo, cliente_nome, cliente_tel, placa, origem, vendedor_id, status, whatsapp_enviado, obs)
     VALUES ($1,$2,$3,$4,$5,$6,'aguard_aprovacao',false,$7)
     RETURNING *`,
    [codigo, clienteNome, clienteTel, placa, origem, vendedorId, obs]
  )
  return rows[0]
}

// Aprova cupom, dispara WhatsApp com cupom e imagem
export async function aprovarCupom(cupomId, adminId) {
  const { rows: [cupom] } = await query('SELECT * FROM cupons WHERE id=$1', [cupomId])
  if (!cupom) throw new Error('Cupom não encontrado')
  if (cupom.status !== 'aguard_aprovacao') throw new Error('Cupom não está aguardando aprovação')

  const config = await getConfig()

  // Dispara WhatsApp
  let waOk = false
  try {
    await enviarCupom({
      numero:     cupom.cliente_tel,
      nome:       cupom.cliente_nome,
      codigo:     cupom.codigo,
      mensagemBase: config.cupom_mensagem,
      imagemUrl:  config.cupom_imagem_url || null,
    })
    waOk = true
  } catch (e) {
    console.error('[cupomService] Erro ao enviar WA:', e.message)
  }

  // Atualiza status
  const { rows: [updated] } = await query(
    `UPDATE cupons SET status='aprovado', whatsapp_enviado=$1, aprovado_por=$2, aprovado_em=NOW()
     WHERE id=$3 RETURNING *`,
    [waOk, adminId, cupomId]
  )

  // Registra no log
  await query(
    `INSERT INTO logs_cupom (cupom_id, acao, usuario_id, detalhes) VALUES ($1,'aprovado',$2,$3)`,
    [cupomId, adminId, JSON.stringify({ waEnviado: waOk })]
  )

  return { cupom: updated, whatsappEnviado: waOk }
}

// Reprova cupom
export async function reprovarCupom(cupomId, adminId) {
  const { rows: [cupom] } = await query('SELECT * FROM cupons WHERE id=$1', [cupomId])
  if (!cupom) throw new Error('Cupom não encontrado')

  const config = await getConfig()

  try {
    await enviarReprovacao({
      numero: cupom.cliente_tel,
      nome:   cupom.cliente_nome,
      mensagemReprovacao: config.jornada_msg_reprovacao,
    })
  } catch (e) {
    console.error('[cupomService] Erro ao enviar reprovação WA:', e.message)
  }

  const { rows: [updated] } = await query(
    `UPDATE cupons SET status='reprovado', aprovado_por=$1, aprovado_em=NOW() WHERE id=$2 RETURNING *`,
    [adminId, cupomId]
  )

  await query(
    `INSERT INTO logs_cupom (cupom_id, acao, usuario_id) VALUES ($1,'reprovado',$2)`,
    [cupomId, adminId]
  )

  return updated
}

// Busca configurações do sistema em cache simples
async function getConfig() {
  try {
    const { rows } = await query('SELECT chave, valor FROM config_sistema')
    return rows.reduce((acc, r) => {
      try { acc[r.chave] = JSON.parse(r.valor) } catch { acc[r.chave] = r.valor }
      return acc
    }, {})
  } catch {
    return {}
  }
}
