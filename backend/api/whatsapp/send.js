// api/whatsapp/send.js — Envio manual de WhatsApp
import { sendWhatsApp } from '../../services/whatsappService.js'
import { ok, err, serverErr, allowMethods } from '../../utils/response.js'

export default async function handler(req, res) {
  const blocked = allowMethods(req, res, ['POST'])
  if (blocked) return

  try {
    const { cliente, telefone, mensagem } = req.body || {}
    if (!cliente)   return err(res, 'cliente é obrigatório')
    if (!telefone)  return err(res, 'telefone é obrigatório')
    if (!mensagem)  return err(res, 'mensagem é obrigatória')

    const data = await sendWhatsApp({ number: telefone, name: cliente, body: mensagem })
    return ok(res, { resultado: data })
  } catch (e) {
    return serverErr(res, e)
  }
}
