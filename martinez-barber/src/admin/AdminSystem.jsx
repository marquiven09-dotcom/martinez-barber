import { useEffect, useState } from 'react'
import { supabase, FUNCTIONS_URL } from '../lib/supabaseClient.js'

export default function AdminSystem() {
  const [settings, setSettings] = useState({})
  const [supabaseOk, setSupabaseOk] = useState(null)
  const [recentErrors, setRecentErrors] = useState([])

  async function load() {
    const { data, error } = await supabase.from('settings').select('*')
    setSupabaseOk(!error)
    const map = {}
    ;(data ?? []).forEach((s) => { map[s.clave] = s.valor })
    setSettings(map)

    const { data: fallos } = await supabase
      .from('bookings').select('nombre, apellido, fecha, confirmation_email_status, reminder_email_status')
      .or('confirmation_email_status.eq.failed,reminder_email_status.eq.failed')
      .order('created_at', { ascending: false }).limit(10)
    setRecentErrors(fallos ?? [])
  }

  useEffect(() => { load() }, [])

  const googleConectado = settings.google_calendar_connected === true || settings.google_calendar_connected === 'true'
  const googleEmail = typeof settings.google_calendar_email === 'string' ? settings.google_calendar_email.replace(/"/g, '') : null

  return (
    <div>
      <h1 className="font-display text-2xl mb-6">Sistema</h1>

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <EstadoCard
          titulo="Base de datos (Supabase)"
          ok={supabaseOk}
          textoOk="Funcionando"
          textoError="No se puede conectar. Comprueba tu conexión a internet."
        />
        <EstadoCard
          titulo="Correo electrónico"
          ok={settings.email_last_error === 'null' || !settings.email_last_error}
          textoOk="Conectado"
          textoError="Hubo un problema enviando el último correo. Mira el detalle abajo."
        />
      </div>

      <div className="card p-5 mb-8">
        <p className="font-medium mb-1">Google Calendar</p>
        {googleConectado ? (
          <p className="text-sm text-green-400 mb-3">🟢 Conectado {googleEmail ? `(${googleEmail})` : ''}</p>
        ) : (
          <p className="text-sm text-muted mb-3">⚪ Todavía no está conectado</p>
        )}
        <a href={`${FUNCTIONS_URL}/google-oauth-start`} className="btn-secondary text-sm">
          {googleConectado ? 'Reconectar Google Calendar' : 'Conectar Google Calendar'}
        </a>
      </div>

      <div className="card p-5 mb-8">
        <p className="font-medium mb-1">WhatsApp</p>
        <p className="text-sm text-muted mb-3">+34 622 56 14 94</p>
        <a href="https://wa.me/34622561494" target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
          Comprobar que el enlace funciona
        </a>
      </div>

      {recentErrors.length > 0 && (
        <div className="card p-5">
          <p className="font-medium mb-3">Últimos errores de envío de email</p>
          <div className="flex flex-col gap-2">
            {recentErrors.map((e, i) => (
              <p key={i} className="text-sm text-muted">
                {e.nombre} {e.apellido} — cita del {e.fecha} ·
                {e.confirmation_email_status === 'failed' ? ' confirmación falló' : ''}
                {e.reminder_email_status === 'failed' ? ' recordatorio falló' : ''}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function EstadoCard({ titulo, ok, textoOk, textoError }) {
  return (
    <div className="card p-5">
      <p className="font-medium mb-1">{titulo}</p>
      <p className={`text-sm ${ok ? 'text-green-400' : 'text-red-400'}`}>
        {ok ? `🟢 ${textoOk}` : `🔴 ${textoError}`}
      </p>
    </div>
  )
}
