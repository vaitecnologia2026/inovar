// utils/formatPhone.js — Remove qualquer caractere não numérico e garante DDI 55
export function formatPhone(phone) {
  let digits = String(phone).replace(/\D/g, '')

  // Adiciona DDI 55 se não tiver
  if (!digits.startsWith('55')) digits = `55${digits}`

  // Remove o nono dígito para números brasileiros (55 + DDD + 9 + 8 dígitos = 13)
  // Formato esperado pela API: 55 + DDD (2) + número (8) = 12 dígitos
  if (digits.length === 13 && digits[4] === '9') {
    digits = digits.slice(0, 4) + digits.slice(5)
  }

  return digits
}

// Formata para exibição: (47) 9999-9999
export function displayPhone(phone) {
  const d = String(phone).replace(/\D/g, '').replace(/^55/, '')
  if (d.length === 9) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`  // com nono
  if (d.length === 8) return `(${d.slice(0,2)}) ${d.slice(2,5)}-${d.slice(5)}`  // sem nono
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return phone
}
