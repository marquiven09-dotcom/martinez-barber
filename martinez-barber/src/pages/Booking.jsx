import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, FUNCTIONS_URL } from '../lib/supabaseClient.js'
import WhatsAppButton from '../components/WhatsAppButton.jsx'

const STEPS = ['Servicio', 'Profesional', 'Día', 'Hora', 'Datos', 'Confirmar']
const DAYS_AHEAD = 45 // hasta dónde se puede reservar por adelantado

function todayISO() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function formatFechaBonita(fecha) {
  const d = new Date(`${fecha}T00:00:00`)
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatDuracion(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

export default function Booking() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  const [services, setServices] = useState([])
  const [servicio, setServicio] = useState(null)
  const [closedDays, setClosedDays] = useState([])
  const [fecha, setFecha] = useState(null)
  const [hora, setHora] = useState(null)
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [form, setForm] = useState({ nombre: '', apellido: '', telefono: '', email: '' })
  const [formErrors, setFormErrors] = useState({})

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [confirmedBooking, setConfirmedBooking] = useState(null)

  useEffect(() => {
    supabase.from('services').select('*').eq('activo', true).order('orden')
      .then(({ data }) => setServices(data ?? []))
    supabase.from('closed_days').select('fecha')
      .then(({ data }) => setClosedDays((data ?? []).map((d) => d.fecha)))
  }, [])

  const availableDates = useMemo(() => {
    const dates = []
    for (let i = 1; i <= DAYS_AHEAD; i++) {
      const d = addDays(todayISO(), i)
      if (!closedDays.includes(d)) dates.push(d)
    }
    return dates
  }, [closedDays])

  async function loadSlots(selectedFecha) {
    if (!servicio) return
    setLoadingSlots(true)
    setSlots([])
    try {
      const res = await fetch(`${FUNCTIONS_URL}/get-available-slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servicio_id: servicio.id, fecha: selectedFecha }),
      })
      const json = await res.json()
      setSlots(json.slots ?? [])
    } catch (err) {
      console.error(err)
      setSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }

  function pickFecha(d) {
    setFecha(d)
    setHora(null)
    loadSlots(d)
    setStep(4)
  }

  function validateForm() {
    const errs = {}
    if (!form.nombre.trim()) errs.nombre = 'Indica tu nombre'
    if (!form.apellido.trim()) errs.apellido = 'Indica tus apellidos'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Correo no válido'
    if (!/^[+]?[0-9\s]{9,15}$/.test(form.telefono)) errs.telefono = 'Teléfono no válido'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function confirmarReserva() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`${FUNCTIONS_URL}/book-appointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          servicio_id: servicio.id,
          fecha,
          hora_inicio: hora,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error || 'No hemos podido confirmar la cita. Inténtalo de nuevo.')
        if (res.status === 409) {
          loadSlots(fecha) // refresca huecos porque ese ya no está libre
        }
        return
      }
      setConfirmedBooking(json.booking)
      setStep(7)
    } catch (err) {
      console.error(err)
      setSubmitError('No hemos podido confirmar la cita. No te preocupes: no se ha creado ninguna reserva. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 7 && confirmedBooking) {
    return <PantallaConfirmacion booking={confirmedBooking} onVolver={() => navigate('/')} />
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="max-w-lg w-full mx-auto px-5 pt-6 pb-4 flex-1">
        <button onClick={() => (step === 1 ? navigate('/') : setStep(step - 1))} className="text-muted text-sm mb-4">
          ← Volver
        </button>

        {step <= 6 && (
          <div className="flex gap-1 mb-8">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-bone' : 'bg-line'}`} />
            ))}
          </div>
        )}

        {step === 1 && (
          <StepServicio services={services} onPick={(s) => { setServicio(s); setStep(2) }} />
        )}

        {step === 2 && (
          <StepProfesional onNext={() => setStep(3)} />
        )}

        {step === 3 && (
          <StepDia dates={availableDates} onPick={pickFecha} />
        )}

        {step === 4 && (
          <StepHora
            fecha={fecha}
            loading={loadingSlots}
            slots={slots}
            onPick={(h) => { setHora(h); setStep(5) }}
          />
        )}

        {step === 5 && (
          <StepDatos
            form={form}
            errors={formErrors}
            onChange={(field, value) => setForm((f) => ({ ...f, [field]: value }))}
            onNext={() => { if (validateForm()) setStep(6) }}
          />
        )}

        {step === 6 && (
          <StepResumen
            servicio={servicio}
            fecha={fecha}
            hora={hora}
            form={form}
            submitting={submitting}
            error={submitError}
            onConfirmar={confirmarReserva}
          />
        )}
      </div>
    </div>
  )
}

function StepServicio({ services, onPick }) {
  return (
    <div>
      <h1 className="font-display text-2xl mb-5">Elige un servicio</h1>
      <div className="flex flex-col gap-3">
        {services.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s)}
            className="card p-4 text-left flex items-center justify-between hover:border-gold transition"
          >
            <div>
              <p className="font-medium">{s.nombre}</p>
              <p className="text-muted text-sm">{formatDuracion(s.duracion_minutos)}</p>
            </div>
            <span className="font-display text-lg">{s.precio} €</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function StepProfesional({ onNext }) {
  return (
    <div>
      <h1 className="font-display text-2xl mb-5">Profesional</h1>
      <div className="card p-5 flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-surface2 border border-line flex items-center justify-center font-display text-xl">
          D
        </div>
        <div>
          <p className="font-medium">Darío</p>
          <p className="text-muted text-sm">Único profesional de Martinez Barber</p>
        </div>
      </div>
      <button onClick={onNext} className="btn-primary w-full">Continuar</button>
    </div>
  )
}

function StepDia({ dates, onPick }) {
  return (
    <div>
      <h1 className="font-display text-2xl mb-5">Elige el día</h1>
      <div className="grid grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto pr-1">
        {dates.map((d) => {
          const date = new Date(`${d}T00:00:00`)
          return (
            <button
              key={d}
              onClick={() => onPick(d)}
              className="card p-3 text-center hover:border-gold transition"
            >
              <div className="text-xs text-muted capitalize">{date.toLocaleDateString('es-ES', { weekday: 'short' })}</div>
              <div className="font-display text-lg">{date.getDate()}</div>
              <div className="text-xs text-muted capitalize">{date.toLocaleDateString('es-ES', { month: 'short' })}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepHora({ fecha, loading, slots, onPick }) {
  return (
    <div>
      <h1 className="font-display text-2xl mb-1">Elige la hora</h1>
      <p className="text-muted text-sm mb-5 capitalize">{formatFechaBonita(fecha)}</p>

      {loading && <p className="text-muted text-sm">Buscando huecos libres…</p>}

      {!loading && slots.length === 0 && (
        <div className="text-center py-10">
          <p className="text-muted text-sm mb-4">No quedan horas libres ese día.</p>
          <WhatsAppButton />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {slots.map((s) => (
          <button key={s} onClick={() => onPick(s)} className="card py-3 text-center hover:border-gold transition">
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function StepDatos({ form, errors, onChange, onNext }) {
  const fields = [
    { key: 'nombre', label: 'Nombre', type: 'text' },
    { key: 'apellido', label: 'Apellidos', type: 'text' },
    { key: 'telefono', label: 'Teléfono', type: 'tel' },
    { key: 'email', label: 'Correo electrónico', type: 'email' },
  ]
  return (
    <div>
      <h1 className="font-display text-2xl mb-5">Tus datos</h1>
      <div className="flex flex-col gap-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-sm text-muted mb-1 block" htmlFor={f.key}>{f.label}</label>
            <input
              id={f.key}
              type={f.type}
              value={form[f.key]}
              onChange={(e) => onChange(f.key, e.target.value)}
              className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-bone outline-none focus:border-gold"
            />
            {errors[f.key] && <p className="text-red-400 text-xs mt-1">{errors[f.key]}</p>}
          </div>
        ))}
      </div>
      <button onClick={onNext} className="btn-primary w-full mt-6">Continuar</button>
    </div>
  )
}

function StepResumen({ servicio, fecha, hora, form, submitting, error, onConfirmar }) {
  return (
    <div>
      <h1 className="font-display text-2xl mb-5">Resumen de tu reserva</h1>
      <div className="card p-5 flex flex-col gap-3 text-sm">
        <Row label="Servicio" value={servicio.nombre} />
        <Row label="Profesional" value="Darío" />
        <Row label="Fecha" value={formatFechaBonita(fecha)} className="capitalize" />
        <Row label="Hora" value={hora} />
        <Row label="Duración" value={formatDuracion(servicio.duracion_minutos)} />
        <Row label="Precio" value={`${servicio.precio} €`} />
        <div className="cut-line my-1" />
        <Row label="Cliente" value={`${form.nombre} ${form.apellido}`} />
        <Row label="Teléfono" value={form.telefono} />
        <Row label="Correo" value={form.email} />
      </div>

      {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

      <button onClick={onConfirmar} disabled={submitting} className="btn-primary w-full mt-6 disabled:opacity-50">
        {submitting ? 'Confirmando…' : 'Confirmar reserva'}
      </button>
    </div>
  )
}

function Row({ label, value, className = '' }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className={className}>{value}</span>
    </div>
  )
}

function PantallaConfirmacion({ booking, onVolver }) {
  const googleCalUrl = buildGoogleCalendarLink(booking)
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-surface border border-gold flex items-center justify-center mx-auto mb-6 text-2xl">
          ✓
        </div>
        <h1 className="font-display text-2xl mb-3">Tu reserva ha sido confirmada</h1>
        <p className="text-muted text-sm mb-8">
          Tu cita ha quedado registrada correctamente. Te hemos enviado la confirmación a tu correo electrónico.
        </p>

        <div className="card p-5 text-sm flex flex-col gap-3 text-left mb-6">
          <Row label="Servicio" value={booking.servicio} />
          <Row label="Fecha" value={formatFechaBonita(booking.fecha)} className="capitalize" />
          <Row label="Hora" value={booking.hora_inicio?.slice(0, 5)} />
          <Row label="Duración" value={formatDuracion(booking.duracion_minutos)} />
          <Row label="Precio" value={`${booking.precio} €`} />
          <Row label="Profesional" value="Darío" />
          <Row label="Dirección" value="Av. Albufera 66, Silla" />
          <Row label="Teléfono" value="+34 622 56 14 94" />
        </div>

        <a href={googleCalUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full mb-3">
          Añadir a Google Calendar
        </a>
        <button onClick={onVolver} className="btn-primary w-full mb-6">Volver al inicio</button>

        <p className="text-muted text-xs">
          ¿Necesitas cancelar o modificar la cita? Llámanos al +34 622 56 14 94
        </p>
      </div>
    </div>
  )
}

function buildGoogleCalendarLink(booking) {
  const start = `${booking.fecha.replace(/-/g, '')}T${booking.hora_inicio.replace(/:/g, '').slice(0, 6)}`
  const end = `${booking.fecha.replace(/-/g, '')}T${booking.hora_fin.replace(/:/g, '').slice(0, 6)}`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Cita en Martinez Barber - ${booking.servicio}`,
    dates: `${start}/${end}`,
    location: 'Av. Albufera 66, Silla, Valencia',
    details: 'Cita en Martinez Barber',
    ctz: 'Europe/Madrid',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
