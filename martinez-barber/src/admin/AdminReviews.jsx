import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

export default function AdminReviews() {
  const [reviews, setReviews] = useState([])
  const [form, setForm] = useState({ nombre: '', texto: '', puntuacion: 5 })

  async function load() {
    const { data } = await supabase.from('reviews').select('*').order('created_at', { ascending: false })
    setReviews(data ?? [])
  }
  useEffect(() => { load() }, [])

  async function anadir() {
    if (!form.nombre || !form.texto) return
    await supabase.from('reviews').insert({ ...form, visible: true })
    setForm({ nombre: '', texto: '', puntuacion: 5 })
    load()
  }
  async function toggleVisible(r) {
    await supabase.from('reviews').update({ visible: !r.visible }).eq('id', r.id)
    load()
  }
  async function eliminar(id) {
    if (!confirm('¿Eliminar esta reseña?')) return
    await supabase.from('reviews').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <h1 className="font-display text-2xl mb-6">Reseñas</h1>

      <div className="card p-4 mb-6">
        <p className="text-sm text-muted mb-3">Añadir reseña</p>
        <input placeholder="Nombre del cliente" value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          className="w-full bg-surface2 border border-line rounded-lg px-3 py-2 text-sm mb-2" />
        <textarea placeholder="Texto de la reseña" value={form.texto}
          onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
          className="w-full bg-surface2 border border-line rounded-lg px-3 py-2 text-sm mb-2" rows={3} />
        <select value={form.puntuacion} onChange={(e) => setForm((f) => ({ ...f, puntuacion: Number(e.target.value) }))}
          className="bg-surface2 border border-line rounded-lg px-3 py-2 text-sm mb-3">
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} estrellas</option>)}
        </select>
        <button onClick={anadir} className="btn-primary !py-2 !px-4 text-sm block">Guardar reseña</button>
      </div>

      <div className="flex flex-col gap-2">
        {reviews.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-center justify-between">
              <p className="text-gold text-sm">{'★'.repeat(r.puntuacion)}{'☆'.repeat(5 - r.puntuacion)}</p>
              <span className={`text-xs ${r.visible ? 'text-green-400' : 'text-muted'}`}>
                {r.visible ? 'Visible en la web' : 'Oculta'}
              </span>
            </div>
            <p className="text-sm mt-2">&ldquo;{r.texto}&rdquo;</p>
            <p className="text-muted text-xs mt-1">{r.nombre}</p>
            <div className="flex gap-3 mt-3">
              <button onClick={() => toggleVisible(r)} className="text-xs text-gold">
                {r.visible ? 'Ocultar' : 'Mostrar'}
              </button>
              <button onClick={() => eliminar(r.id)} className="text-xs text-red-400">Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
