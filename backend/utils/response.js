// utils/response.js — Helpers de resposta padronizados
export const ok      = (res, data = {})         => res.status(200).json({ ok: true,  ...data })
export const created = (res, data = {})          => res.status(201).json({ ok: true,  ...data })
export const err     = (res, msg, status = 400)  => res.status(status).json({ ok: false, error: msg })
export const notFound = (res, msg = 'Não encontrado') => err(res, msg, 404)
export const serverErr = (res, e) => {
  console.error('[API]', e?.message || e)
  return err(res, 'Erro interno do servidor', 500)
}

export function setCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://inovar-six.vercel.app')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true
  }
  return false
}

export function allowMethods(req, res, methods) {
  if (!methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '))
    return err(res, `Método ${req.method} não permitido`, 405)
  }
  return null
}
