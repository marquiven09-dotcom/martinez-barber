import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

function todayISO() { return new Date().toISOString().slice(0, 10) }

function startOfWeekISO() {
  const d = new Date()
  const day = (d.getDay() + 6) % 7 // lunes = 0
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}
function endOfWeekISO() {
  const d = new Date(startOfWeekISO())
  d.setDate(d.getDate() + 6)
  return d.toISOString().slice(0, 10)
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ hoy: 0, semana: 0, ingresos: 0 })
  const [proximas, setProximas] = useState([])

  useEffect(() => {
    async function load() {
      const hoy = todayISO()

      const { data: citasHoy } = await supabase
        .from('bookings').select('id').eq('fecha', hoy).in('estado', ['pending', 'confirmed'])

      const { data: citasSemana } = await supabase
        .from('bookings').select('precio')
        .gte('fecha', startOfWeekISO()).lte('fecha', endOfWeekISO())
        .in('estado', ['pending', 'confirmed', 'completed'])

      const ingresos = (citasSemana ?? []).reduce((sum, b) => sum + Number(b.precio), 0)

      const { data: prox } = await supabase
        .from('bookings').select('*')
        .gte('fecha', hoy).in('estado', ['pending', 'confirmed'])
        .order('fecha').order('hora_inicio').limit(8)

      setStats({ hoy: citasHoy?.length ?? 0, semana: citasSemana?.length ?? 0, ingresos })
      setProximas(prox ?? [])
    }
    load()
  }, [])

  return (
    <div>
      <h1 className="font-display text-2xl mb-1">Buenos días, Darío</h1>
      <p className="text-muted text-sm mb-8">Esto es lo que tienes por delante</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <Card label="Citas de hoy" value={stats.hoy} />
        <Card label="Citas esta semana" value={stats.semana} />
        <Card label="Ingresos estimados (semana)" value={`${stats.ingresos.toFixed(2)} €`} />
        <Card
          label="Próxima cita"
          value={proximas[0] ? `${proximas[0].hora_inicio.slice(0,5)}` : '—'}
        />
      </div>

      <h2 className="font-display text-lg mb-4">Próximas citas</h2>
      <div className="flex flex-col gap-3">
        {proximas.length === 0 && <p className="text-muted text-sm">No hay citas próximas.</p>}
        {proximas.map((b) => (
          <div key={b.id} className="card p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{b.hora_inicio.slice(0, 5)} · {b.nombre} {b.apellido}</p>
              <p className="text-muted text-sm">{b.servicio_nombre} · {new Date(`${b.fecha}T00:00:00`).toLocaleDateString('es-ES')}</p>
            </div>
            <span className="font-display">{b.precio} €</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Card({ label, value }) {
  return (
    <div className="card p-4">
      <p className="text-muted text-xs mb-1">{label}</p>
      <p className="font-display text-xl">{value}</p>
    </div>
  )
}
