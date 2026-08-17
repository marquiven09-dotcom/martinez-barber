import { useEffect, useState } from 'react'
import { supabase, FUNCTIONS_URL } from '../lib/supabaseClient.js'

const ESTADO_LABEL = {
  pending: 'Pendiente', confirmed: 'Confirmada', cancelled: 'Cancelada',
  completed: 'Completada', error: 'Error',
}

function todayISO() { return new Date().toISOString().slice(0, 10) }
function tomorrowISO() {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10)
}

export default function AdminBookings() {
  const [filtro, setFiltro] = useState('hoy') // hoy | manana | proximas | todas
  const [bookings, setBookings] = useState([])
  const [showManual, setShowManual] = useState(false)

  async function load() {
    let query = supabase.from('bookings').select('*').order('fecha').order('hora_inicio')
    if (filtro === 'hoy') query = query.eq('fecha', todayISO())
    if (filtro === 'manana') query = query.eq('fecha', tomorrowISO())
    if (filtro === 'proximas') query = query.gte('fecha', todayISO()).in('estado', ['pending', 'confirmed'])
    const { data } = await query
    setBookings(data ?? [])
  }

  useEffect(() => { load() }, [filtro])

  async function marcarCompletada(id) {
    await supabase.from('bookings').update({ estado: 'completed' }).eq('id', id)
    load()
  }

  async function cancelar(id) {
    if (!confirm('¿Seguro que quieres cancelar esta cita? Se avisará al cliente por email.')) return
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${FUNCTIONS_URL}/cancel-appointment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ booking_id: id }),
    })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-display text-2xl">Citas</h1>
        <button onClick={() => setShowManual(true)} className="btn-primary !py-2 !px-4 text-sm">
          + Añadir cita manual
        </button>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          ['hoy', 'Hoy'], ['manana', 'Mañana'], ['proximas', 'Próximas'], ['todas', 'Todas'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFiltro(key)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap border ${
              filtro === key ? 'bg-bone text-ink border-bone' : 'border-line text-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {bookings.length === 0 && <p className="text-muted text-sm">No hay citas en este filtro.</p>}
        {bookings.map((b) => (
          <div key={b.id} className="card p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-medium">
                  {new Date(`${b.fecha}T00:00:00`).toLocaleDateString('es-ES')} · {b.hora_inicio.slice(0,5)} — {b.nombre} {b.apellido}
                </p>
                <p className="text-muted text-sm">{b.servicio_nombre} · {b.precio} € · {b.telefono} · {b.email}</p>
                <p className="text-xs text-muted mt-1">
                  Estado: {ESTADO_LABEL[b.estado] ?? b.estado}
                  {b.origen === 'manual' ? ' · añadida a mano' : ''}
                </p>
              </div>
              {(b.estado === 'pending' || b.estado === 'confirmed') && (
                <div className="flex gap-2">
                  <button onClick={() => marcarCompletada(b.id)} className="btn-secondary !py-2 !px-3 text-xs">
                    Completada
                  </button>
                  <button onClick={() => cancelar(b.id)} className="btn-secondary !py-2 !px-3 text-xs !border-red-500 text-red-400">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showManual && <ManualBookingModal onClose={() => setShowManual(false)} onCreated={load} />}
    </div>
  )
}

function ManualBookingModal({ onClose, onCreated }) {
  const [services, setServices] = useState([])
  const [servicio, setServicio] = useState('')
  const [fecha, setFecha] = useState('')
  const [slots, setSlots] = useState([])
  const [hora, setHora] = useState('')
  const [form, setForm] = useState({ nombre: '', apellido: '', telefono: '', email: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('services').select('*').eq('activo', true).order('orden')
      .then(({ data }) => setServices(data ?? []))
  }, [])

  useEffect(() => {
    if (!servicio || !fecha) { setSlots([]); return }
    fetch(`${FUNCTIONS_URL}/get-available-slots`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ servicio_id: servicio, fecha }),
    }).then((r) => r.json()).then((j) => setSlots(j.slots ?? []))
  }, [servicio, fecha])

  async function guardar() {
    setSaving(true)
    setError(null)
    const res = await fetch(`${FUNCTIONS_URL}/book-appointment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, servicio_id: servicio, fecha, hora_inicio: hora, origen: 'manual' }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error); return }
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-5 z-50">
      <div className="card p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
        <h2 className="font-display text-xl mb-4">Añadir cita manual</h2>

        <label className="text-sm text-muted mb-1 block">Servicio</label>
        <select value={servicio} onChange={(e) => setServicio(e.target.value)}
          className="w-full bg-surface2 border border-line rounded-xl px-4 py-3 mb-3">
          <option value="">Selecciona…</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.nombre} — {s.precio} €</option>)}
        </select>

        <label className="text-sm text-muted mb-1 block">Fecha</label>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
          className="w-full bg-surface2 border border-line rounded-xl px-4 py-3 mb-3" />

        <label className="text-sm text-muted mb-1 block">Hora</label>
        <select value={hora} onChange={(e) => setHora(e.target.value)}
          className="w-full bg-surface2 border border-line rounded-xl px-4 py-3 mb-3">
          <option value="">Selecciona…</option>
          {slots.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {['nombre', 'apellido', 'telefono', 'email'].map((f) => (
          <input
            key={f} placeholder={f[0].toUpperCase() + f.slice(1)}
            value={form[f]} onChange={(e) => setForm((v) => ({ ...v, [f]: e.target.value }))}
            className="w-full bg-surface2 border border-line rounded-xl px-4 py-3 mb-3"
          />
        ))}

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <div className="flex gap-3 mt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={guardar} disabled={saving || !servicio || !fecha || !hora} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar cita'}
          </button>
        </div>
      </div>
    </div>
  )
}
