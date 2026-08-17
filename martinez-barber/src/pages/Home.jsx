import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import WhatsAppButton from '../components/WhatsAppButton.jsx'

const MAPS_QUERY = encodeURIComponent('Av. Albufera 66, Silla, Valencia')

function formatDuracion(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

// Placeholders claramente identificados: sustitúyelos por fotos reales
// desde el panel de administración cuando las tengas.
const CORTES_PLACEHOLDER = Array.from({ length: 6 }).map((_, i) => ({
  id: i,
  label: `Foto de corte ${i + 1} (pendiente)`,
}))

export default function Home() {
  const navigate = useNavigate()
  const [services, setServices] = useState([])
  const [reviews, setReviews] = useState([])

  useEffect(() => {
    supabase
      .from('services')
      .select('*')
      .eq('activo', true)
      .order('orden')
      .then(({ data }) => setServices(data ?? []))

    supabase
      .from('reviews')
      .select('*')
      .eq('visible', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setReviews(data ?? []))
  }, [])

  return (
    <div>
      <Navbar />

      {/* ---------- HERO ---------- */}
      <section className="max-w-3xl mx-auto px-5 pt-16 pb-20 text-center">
        <h1 className="font-display text-4xl md:text-6xl font-bold tracking-wide">
          MARTINEZ BARBER
        </h1>
        <div className="cut-line max-w-xs mx-auto my-6" />
        <p className="text-muted text-base md:text-lg max-w-md mx-auto">
          Precisión, estilo y personalidad en cada corte. Barbería masculina
          con una atención cuidada al detalle, en Silla, Valencia.
        </p>
        <button onClick={() => navigate('/reservar')} className="btn-primary mt-8 text-base">
          Pedir cita →
        </button>
      </section>

      {/* ---------- PRECIOS ---------- */}
      <section id="precios" className="max-w-3xl mx-auto px-5 py-14">
        <h2 className="font-display text-2xl tracking-wide mb-6">Precios</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {services.map((s) => (
            <div key={s.id} className="card p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium">{s.nombre}</h3>
                <span className="font-display text-xl">{s.precio} €</span>
              </div>
              <p className="text-muted text-sm mt-1">{formatDuracion(s.duracion_minutos)}</p>
            </div>
          ))}
        </div>
        <button onClick={() => navigate('/reservar')} className="btn-primary mt-8 w-full sm:w-auto">
          Pedir cita →
        </button>
      </section>

      {/* ---------- CORTES ---------- */}
      <section id="cortes" className="max-w-5xl mx-auto px-5 py-14">
        <h2 className="font-display text-2xl tracking-wide mb-6">Cortes</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {CORTES_PLACEHOLDER.map((c) => (
            <div
              key={c.id}
              className="aspect-square rounded-2xl border border-line bg-surface flex items-center justify-center text-center text-xs text-muted p-3 md:hover:border-gold transition"
            >
              {c.label}
            </div>
          ))}
        </div>
      </section>

      {/* ---------- RESEÑAS ---------- */}
      <section id="resenas" className="max-w-3xl mx-auto px-5 py-14">
        <h2 className="font-display text-2xl tracking-wide mb-6">Reseñas</h2>
        {reviews.length === 0 && (
          <p className="text-muted text-sm">Todavía no hay reseñas publicadas.</p>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          {reviews.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="text-gold text-sm mb-2">{'★'.repeat(r.puntuacion)}{'☆'.repeat(5 - r.puntuacion)}</div>
              <p className="text-sm text-bone">&ldquo;{r.texto}&rdquo;</p>
              <p className="text-muted text-xs mt-3">{r.nombre}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- UBICACIÓN ---------- */}
      <section id="ubicacion" className="max-w-3xl mx-auto px-5 py-14">
        <h2 className="font-display text-2xl tracking-wide mb-6">Dónde nos encontramos</h2>
        <div className="rounded-2xl overflow-hidden border border-line mb-5">
          <iframe
            title="Ubicación Martinez Barber"
            src={`https://maps.google.com/maps?q=${MAPS_QUERY}&z=16&output=embed`}
            width="100%"
            height="280"
            style={{ border: 0 }}
            loading="lazy"
          />
        </div>
        <p className="text-bone">Av. Albufera 66, Silla, Valencia</p>
        <p className="text-muted text-sm">+34 622 56 14 94 · @martinez._ba.rber</p>
        <div className="flex flex-wrap gap-3 mt-5">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${MAPS_QUERY}`}
            target="_blank" rel="noopener noreferrer"
            className="btn-primary"
          >
            Cómo llegar
          </a>
          <WhatsAppButton />
        </div>
      </section>

      <Footer />
    </div>
  )
}
