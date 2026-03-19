// api/colaboradores/index.js — Gestão de colaboradores
import { query } from '../../lib/db.js'
import { ok, created, err, serverErr, allowMethods, setCors } from '../../utils/response.js'
import { sendWhatsApp } from '../../services/whatsappService.js'
import crypto from 'crypto'

function hashSenha(senha) {
  return crypto.createHash('sha256').update(senha + process.env.JWT_SECRET).digest('hex')
}

async function getConfig() {
  const { rows } = await query('SELECT chave, valor FROM config_sistema')
  return Object.fromEntries(rows.map(r => [r.chave, r.valor]))
}

export default async function handler(req, res) {
  if (setCors(req, res)) return

  const blocked = allowMethods(req, res, ['GET', 'POST', 'PUT'])
  if (blocked) return

  try {
    // ── GET — listar colaboradores ──────────────────────
    if (req.method === 'GET') {
      const { status } = req.query
      let sql = `SELECT id, nome, login, perfil, avatar, meta, ativo, status, whatsapp, criado_em
                 FROM colaboradores`
      const params = []
      if (status) {
        sql += ` WHERE status=$1`
        params.push(status)
      }
      sql += ` ORDER BY (status='pendente') DESC, ativo DESC, nome`
      const { rows } = await query(sql, params)
      return ok(res, { colaboradores: rows })
    }

    // ── POST — criar colaborador ────────────────────────
    if (req.method === 'POST') {
      const { nome, login, senha, perfil = 'vendedor', meta = 0, avatar, whatsapp = '' } = req.body || {}

      if (!nome)  return err(res, 'Nome é obrigatório')
      if (!login) return err(res, 'Login é obrigatório')
      if (!senha || senha.length < 6) return err(res, 'Senha precisa ter mínimo 6 caracteres')

      const perfisValidos = ['admin','supervisor','gerente','vendedor','retencao','site','backoffice']
      if (!perfisValidos.includes(perfil)) return err(res, 'Perfil inválido')

      const { rows: dup } = await query('SELECT id FROM colaboradores WHERE login=$1', [login])
      if (dup.length) return err(res, 'Login já está em uso', 409)

      const av = (avatar || nome[0] || '?').toUpperCase().charAt(0)

      const { rows: [collab] } = await query(
        `INSERT INTO colaboradores (nome, login, senha_hash, perfil, meta, avatar, whatsapp, status, ativo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'ativo',true)
         RETURNING id, nome, login, perfil, avatar, meta, ativo, status, whatsapp, criado_em`,
        [nome, login, hashSenha(senha), perfil, meta, av, whatsapp]
      )
      return created(res, { colaborador: collab })
    }

    // ── PUT — atualizar / aprovar colaborador ─────────────────────
    if (req.method === 'PUT') {
      const { id, nome, login, senha, perfil, meta, avatar, ativo, whatsapp, aprovar } = req.body || {}
      if (!id) return err(res, 'ID é obrigatório')

      // Busca estado atual para detectar aprovação
      const { rows: [atual] } = await query(
        'SELECT status, whatsapp, nome, login FROM colaboradores WHERE id=$1', [id]
      )
      if (!atual) return err(res, 'Colaborador não encontrado', 404)

      const aprovando = aprovar === true || (ativo === true && atual.status === 'pendente')
      const novoStatus = aprovando ? 'ativo' : (ativo === false ? 'inativo' : atual.status)
      const novoAtivo  = novoStatus === 'ativo'

      let senhaClause = ''
      const params = [nome, login, perfil, meta, avatar, novoAtivo, novoStatus, whatsapp, id]
      if (senha && senha.length >= 6) {
        senhaClause = ', senha_hash=$10'
        params.push(hashSenha(senha))
      }

      const { rows: [updated] } = await query(
        `UPDATE colaboradores SET
           nome     = COALESCE($1, nome),
           login    = COALESCE($2, login),
           perfil   = COALESCE($3, perfil),
           meta     = COALESCE($4, meta),
           avatar   = COALESCE($5, avatar),
           ativo    = $6,
           status   = $7,
           whatsapp = COALESCE($8, whatsapp)
           ${senhaClause}
         WHERE id=$9
         RETURNING id, nome, login, perfil, avatar, meta, ativo, status, whatsapp, criado_em`,
        params
      )

      // Dispara WhatsApp se acabou de aprovar
      if (aprovando) {
        const numeroWA = updated.whatsapp || atual.whatsapp
        if (numeroWA) {
          try {
            const cfg = await getConfig()
            const msgTemplate = cfg.msg_aprovacao_acesso ||
              'Olá {nome}! 🎉 Seu acesso ao sistema INOVAR foi aprovado. Login: *{login}* Bem-vindo(a)!'
            const msg = msgTemplate
              .replace('{nome}',  updated.nome  || atual.nome)
              .replace('{login}', updated.login || atual.login)

            await sendWhatsApp({
              number: numeroWA,
              name:   updated.nome || atual.nome,
              body:   msg,
            })
          } catch (e) {
            console.error('[colaboradores] Erro ao enviar WA aprovação:', e.message)
          }
        }
      }

      return ok(res, { colaborador: updated })
    }
  } catch (e) {
    return serverErr(res, e)
  }
}
