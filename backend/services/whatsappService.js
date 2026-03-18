// services/whatsappService.js — Integração API WhatsApp VAI (padrão obrigatório do PDF)
import axios from 'axios'
import { formatPhone } from '../utils/formatPhone.js'

/**
 * Envia uma mensagem WhatsApp via API VAI
 * @param {object} params
 * @param {string} params.number   - Telefone do destinatário (qualquer formato)
 * @param {string} params.name     - Nome do destinatário
 * @param {string} params.body     - Corpo da mensagem
 * @param {string} [params.imageUrl] - URL da imagem (opcional)
 */
export async function sendWhatsApp({ number, name, body, imageUrl = null }) {
  const message = {
    number: formatPhone(number),
    name,
    body,
  }
  if (imageUrl) message.imageUrl = imageUrl

  const res = await axios.post(
    process.env.WHATSAPP_API_URL,
    {
      whatsappId: process.env.WHATSAPP_ID,
      messages: [message],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  )
  return res.data
}

/**
 * Envia cupom com imagem padrão INOVAR
 * @param {object} params
 * @param {string} params.numero   - Telefone do cliente
 * @param {string} params.nome     - Nome do cliente
 * @param {string} params.codigo   - Código do cupom (ex: INV-2026-0042)
 * @param {string} [params.mensagemBase] - Mensagem personalizada
 * @param {string} [params.imagemUrl]    - URL da imagem do cupom
 */
export async function enviarCupom({ numero, nome, codigo, mensagemBase, imagemUrl }) {
  const msg = (mensagemBase || 'Olá {nome}! 🎉 Seu cupom de participação é {codigo}. Boa sorte!')
    .replace('{nome}', nome)
    .replace('{codigo}', codigo)

  return sendWhatsApp({ number: numero, name: nome, body: msg, imageUrl: imagemUrl || null })
}

/**
 * Envia mensagem de aprovação do sorteio
 */
export async function enviarAprovacao({ numero, nome, codigo, mensagemAprovacao }) {
  const msg = (mensagemAprovacao || 'Parabéns {nome}! Seu cadastro no sorteio foi confirmado. Cupom: *{codigo}*')
    .replace('{nome}', nome)
    .replace('{codigo}', codigo)

  return sendWhatsApp({ number: numero, name: nome, body: msg })
}

/**
 * Envia mensagem de reprovação
 */
export async function enviarReprovacao({ numero, nome, mensagemReprovacao }) {
  const msg = (mensagemReprovacao || 'Olá {nome}, infelizmente seu cadastro não foi aprovado. Entre em contato conosco.')
    .replace('{nome}', nome)

  return sendWhatsApp({ number: numero, name: nome, body: msg })
}

/**
 * Envia follow-up da jornada
 */
export async function enviarFollowUp({ numero, nome, codigo, mensagem }) {
  const msg = mensagem
    .replace('{nome}', nome)
    .replace('{codigo}', codigo)

  return sendWhatsApp({ number: numero, name: nome, body: msg })
}

/**
 * Envia relatório para equipe
 */
export async function enviarRelatorio({ numero, nome, corpo }) {
  return sendWhatsApp({ number: numero, name: nome, body: corpo })
}
