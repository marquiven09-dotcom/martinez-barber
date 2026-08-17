import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const LINKS = [
  { href: '#precios', label: 'Precios' },
  { href: '#cortes', label: 'Cortes' },
  { href: '#resenas', label: 'Reseñas' },
  { href: '#ubicacion', label: 'Dónde nos encontramos' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-40 bg-ink/90 backdrop-blur border-b border-line">
      <nav className="max-w-5xl mx-auto flex items-center justify-between px-5 py-4">
        <Link to="/" className="font-display text-lg font-semibold tracking-wide">
          MARTINEZ BARBER
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-muted hover:text-bone transition">
              {l.label}
            </a>
          ))}
          <button onClick={() => navigate('/reservar')} className="btn-primary !py-2 !px-5 text-sm">
            Citas
          </button>
        </div>

        <button
          className="md:hidden text-bone"
          aria-label="Abrir menú"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-line bg-ink px-5 py-4 flex flex-col gap-4">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-bone text-base">
              {l.label}
            </a>
          ))}
          <button
            onClick={() => { setOpen(false); navigate('/reservar') }}
            className="btn-primary w-full mt-2"
          >
            Pedir cita →
          </button>
        </div>
      )}
    </header>
  )
}
