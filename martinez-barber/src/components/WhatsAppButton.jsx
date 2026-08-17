// Enlace correcto de WhatsApp: sin "+" ni espacios en el número.
const WHATSAPP_URL = 'https://wa.me/34622561494'

export default function WhatsAppButton({ className = '', children = 'Escríbenos por WhatsApp' }) {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn-secondary ${className}`}
    >
      {children}
    </a>
  )
}
