// utils/formatPhone.js — Remove qualquer caractere não numérico e garante DDI 55
export function formatPhone(phone) {
  const digits = String(phone).replace(/\D/g, '')
  // Se não começa com 55 (Brasil), adiciona
  return digits.startsWith('55') ? digits : `55${digits}`
}

// Formata para exibição: (47) 99999-9999
export function displayPhone(phone) {
  const d = String(phone).replace(/\D/g, '').replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return phone
}
