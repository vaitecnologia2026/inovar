// api/whatsapp/config.js — Leitura e escrita das configurações do sistema
import { query } from '../../lib/db.js'
import { ok, err, serverErr, allowMethods, setCors } from '../../utils/response.js'

export default async function handler(req, res) {
  if (setCors(req, res)) return

  const blocked = allowMethods(req, res, ['GET', 'POST'])
  if (blocked) return

  try {
    // ── GET — retorna todas ou por categoria ────────────
    if (req.method === 'GET') {
      const { categoria } = req.query
      const sql = categoria
        ? `SELECT chave, valor, categoria FROM config_sistema WHERE categoria=$1 ORDER BY chave`
        : `SELECT chave, valor, categoria FROM config_sistema ORDER BY categoria, chave`

      const { rows } = await query(sql, categoria ? [categoria] : [])

      // Retorna como objeto chave: valor
      const config = rows.reduce((acc, r) => {
        acc[r.chave] = r.valor
        return acc
      }, {})

      return ok(res, { config, rows })
    }

    // ── POST — salvar/atualizar configurações ───────────
    if (req.method === 'POST') {
      const updates = req.body || {}
      const keys = Object.keys(updates)

      if (!keys.length) return err(res, 'Nenhuma configuração enviada')

      // Upsert em lote
      for (const chave of keys) {
        await query(
          `INSERT INTO config_sistema (chave, valor, categoria, atualizado_em)
           VALUES ($1, $2, 'geral', NOW())
           ON CONFLICT (chave) DO UPDATE
             SET valor=$2, atualizado_em=NOW()`,
          [chave, String(updates[chave])]
        )
      }

      return ok(res, { atualizado: keys.length, chaves: keys })
    }
  } catch (e) {
    return serverErr(res, e)
  }
}