import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const TABS = ['Horarios', 'Días cerrados', 'Bloquear horas', 'Servicios']

export default function AdminSettings() {
  const [tab, setTab] = useState(TABS[0])
  return (
    <div>
      <h1 className="font-display text-2xl mb-6">Horarios y servicios</h1>
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap border ${tab === t ? 'bg-bone text-ink border-bone' : 'border-line text-muted'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Horarios' && <Horarios />}
      {tab === 'Días cerrados' && <DiasCerrados />}
      {tab === 'Bloquear horas' && <HorasBloqueadas />}
      {tab === 'Servicios' && <Servicios />}
    </div>
  )
}

function Horarios() {
  const [hours, setHours] = useState([])

  async function load() {
    const { data } = await supabase.from('business_hours').select('*').order('dia_semana')
    setHours(data ?? [])
  }
  useEffect(() => { load() }, [])

  async function actualizar(id, campo, valor) {
    setHours((h) => h.map((x) => (x.id === id ? { ...x, [campo]: valor } : x)))
  }
  async function guardar(row) {
    await supabase.from('business_hours').update({
      hora_inicio: row.hora_inicio, hora_fin: row.hora_fin, activo: row.activo,
    }).eq('id', row.id)
  }
  async function eliminarTramo(id) {
    await supabase.from('business_hours').delete().eq('id', id)
    load()
  }
  async function anadirTramo(dia) {
    await supabase.from('business_hours').insert({ dia_semana: dia, hora_inicio: '10:00', hora_fin: '13:00' })
    load()
  }

  return (
    <div className="flex flex-col gap-6">
      {DIAS.map((nombre, dia) => {
        const tramos = hours.filter((h) => h.dia_semana === dia)
        return (
          <div key={dia} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-medium">{nombre}</p>
              <button onClick={() => anadirTramo(dia)} className="text-xs text-gold">+ Añadir tramo</button>
            </div>
            {tramos.length === 0 && <p className="text-muted text-sm">Cerrado</p>}
            {tramos.map((t) => (
              <div key={t.id} className="flex items-center gap-2 mb-2">
                <input type="time" value={t.hora_inicio.slice(0,5)}
                  onChange={(e) => actualizar(t.id, 'hora_inicio', e.target.value)}
                  onBlur={() => guardar(t)}
                  className="bg-surface2 border border-line rounded-lg px-2 py-1 text-sm" />
                <span className="text-muted">—</span>
                <input type="time" value={t.hora_fin.slice(0,5)}
                  onChange={(e) => actualizar(t.id, 'hora_fin', e.target.value)}
                  onBlur={() => guardar(t)}
                  className="bg-surface2 border border-line rounded-lg px-2 py-1 text-sm" />
                <label className="flex items-center gap-1 text-xs text-muted ml-2">
                  <input type="checkbox" checked={t.activo}
                    onChange={(e) => { actualizar(t.id, 'activo', e.target.checked); guardar({ ...t, activo: e.target.checked }) }} />
                  activo
                </label>
                <button onClick={() => eliminarTramo(t.id)} className="text-red-400 text-xs ml-auto">Eliminar</button>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function DiasCerrados() {
  const [dias, setDias] = useState([])
  const [fecha, setFecha] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [motivo, setMotivo] = useState('')

  async function load() {
    const { data } = await supabase.from('closed_days').select('*').order('fecha')
    setDias(data ?? [])
  }
  useEffect(() => { load() }, [])

  async function anadir() {
    if (!fecha) return
    const inicio = new Date(`${fecha}T00:00:00`)
    const fin = fechaFin ? new Date(`${fechaFin}T00:00:00`) : inicio
    const filas = []
    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      filas.push({ fecha: d.toISOString().slice(0, 10), motivo: motivo || null })
    }
    await supabase.from('closed_days').upsert(filas, { onConflict: 'fecha' })
    setFecha(''); setFechaFin(''); setMotivo('')
    load()
  }
  async function eliminar(id) {
    await supabase.from('closed_days').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div className="card p-4 mb-6">
        <p className="text-sm text-muted mb-3">Añadir un día, o un intervalo de vacaciones (fecha fin opcional)</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
            className="bg-surface2 border border-line rounded-lg px-3 py-2 text-sm" />
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
            placeholder="hasta (opcional)" className="bg-surface2 border border-line rounded-lg px-3 py-2 text-sm" />
          <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (opcional)" className="bg-surface2 border border-line rounded-lg px-3 py-2 text-sm flex-1" />
        </div>
        <button onClick={anadir} className="btn-primary !py-2 !px-4 text-sm">Añadir día(s) cerrado(s)</button>
      </div>

      <div className="flex flex-col gap-2">
        {dias.map((d) => (
          <div key={d.id} className="card p-3 flex items-center justify-between">
            <span>{new Date(`${d.fecha}T00:00:00`).toLocaleDateString('es-ES')} {d.motivo ? `— ${d.motivo}` : ''}</span>
            <button onClick={() => eliminar(d.id)} className="text-red-400 text-xs">Eliminar</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function HorasBloqueadas() {
  const [bloqueos, setBloqueos] = useState([])
  const [fecha, setFecha] = useState('')
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFin, setHoraFin] = useState('')
  const [motivo, setMotivo] = useState('')

  async function load() {
    const { data } = await supabase.from('blocked_times').select('*').order('fecha')
    setBloqueos(data ?? [])
  }
  useEffect(() => { load() }, [])

  async function anadir() {
    if (!fecha || !horaInicio || !horaFin) return
    await supabase.from('blocked_times').insert({ fecha, hora_inicio: horaInicio, hora_fin: horaFin, motivo: motivo || null })
    setFecha(''); setHoraInicio(''); setHoraFin(''); setMotivo('')
    load()
  }
  async function eliminar(id) {
    await supabase.from('blocked_times').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-2 mb-3">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
            className="bg-surface2 border border-line rounded-lg px-3 py-2 text-sm" />
          <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)}
            className="bg-surface2 border border-line rounded-lg px-3 py-2 text-sm" />
          <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)}
            className="bg-surface2 border border-line rounded-lg px-3 py-2 text-sm" />
          <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (opcional)" className="bg-surface2 border border-line rounded-lg px-3 py-2 text-sm flex-1" />
        </div>
        <button onClick={anadir} className="btn-primary !py-2 !px-4 text-sm">Bloquear horario</button>
      </div>

      <div className="flex flex-col gap-2">
        {bloqueos.map((b) => (
          <div key={b.id} className="card p-3 flex items-center justify-between">
            <span>
              {new Date(`${b.fecha}T00:00:00`).toLocaleDateString('es-ES')} · {b.hora_inicio.slice(0,5)}–{b.hora_fin.slice(0,5)}
              {b.motivo ? ` — ${b.motivo}` : ''}
            </span>
            <button onClick={() => eliminar(b.id)} className="text-red-400 text-xs">Eliminar</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function Servicios() {
  const [services, setServices] = useState([])

  async function load() {
    const { data } = await supabase.from('services').select('*').order('orden')
    setServices(data ?? [])
  }
  useEffect(() => { load() }, [])

  function actualizar(id, campo, valor) {
    setServices((s) => s.map((x) => (x.id === id ? { ...x, [campo]: valor } : x)))
  }
  async function guardar(row) {
    await supabase.from('services').update({
      nombre: row.nombre, precio: row.precio, duracion_minutos: row.duracion_minutos, activo: row.activo,
    }).eq('id', row.id)
  }

  return (
    <div className="flex flex-col gap-3">
      {services.map((s) => (
        <div key={s.id} className="card p-4">
          <input value={s.nombre} onChange={(e) => actualizar(s.id, 'nombre', e.target.value)}
            onBlur={() => guardar(s)}
            className="bg-transparent font-medium mb-3 w-full outline-none border-b border-transparent focus:border-line" />
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-muted">Precio (€)
              <input type="number" step="0.5" value={s.precio}
                onChange={(e) => actualizar(s.id, 'precio', e.target.value)}
                onBlur={() => guardar(s)}
                className="block bg-surface2 border border-line rounded-lg px-3 py-2 text-sm w-28 mt-1" />
            </label>
            <label className="text-xs text-muted">Duración (min)
              <input type="number" step="5" value={s.duracion_minutos}
                onChange={(e) => actualizar(s.id, 'duracion_minutos', e.target.value)}
                onBlur={() => guardar(s)}
                className="block bg-surface2 border border-line rounded-lg px-3 py-2 text-sm w-28 mt-1" />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted mt-4">
              <input type="checkbox" checked={s.activo}
                onChange={(e) => { actualizar(s.id, 'activo', e.target.checked); guardar({ ...s, activo: e.target.checked }) }} />
              Activo (visible y reservable en la web)
            </label>
          </div>
        </div>
      ))}
    </div>
  )
}
