// api/relatorio/index.js — Gerar e enviar relatório manualmente
import { gerarRelatorio, enviarRelatorioParaEquipe } from '../../services/relatorioService.js'
import { ok, serverErr, allowMethods, setCors } from '../../utils/response.js'

export default async function handler(req, res) {
  if (setCors(req, res)) return

  const blocked = allowMethods(req, res, ['GET', 'POST'])
  if (blocked) return

  try {
    // ── GET — preview do relatório ──────────────────────
    if (req.method === 'GET') {
      const { corpo, totais, ranking } = await gerarRelatorio()
      return ok(res, { preview: corpo, totais, ranking })
    }

    // ── POST — disparar envio agora ─────────────────────
    if (req.method === 'POST') {
      const resultado = await enviarRelatorioParaEquipe()
      return ok(res, resultado)
    }
  } catch (e) {
    return serverErr(res, e)
  }
}
