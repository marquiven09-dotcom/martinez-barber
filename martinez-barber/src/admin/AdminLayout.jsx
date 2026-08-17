import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'

const LINKS = [
  { to: '/admin', label: 'Panel', end: true },
  { to: '/admin/citas', label: 'Citas' },
  { to: '/admin/ajustes', label: 'Horarios y servicios' },
  { to: '/admin/resenas', label: 'Reseñas' },
  { to: '/admin/sistema', label: 'Sistema' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
      if (!data.session) navigate('/admin/login')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) navigate('/admin/login')
    })
    return () => sub.subscription.unsubscribe()
  }, [navigate])

  if (checking) return null
  if (!session) return null

  return (
    <div className="min-h-screen md:flex">
      <aside className="md:w-56 border-b md:border-b-0 md:border-r border-line p-5">
        <div className="font-display text-lg tracking-wide mb-6">MARTINEZ BARBER</div>
        <nav className="flex md:flex-col gap-2 overflow-x-auto">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                  isActive ? 'bg-surface text-bone' : 'text-muted hover:text-bone'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={async () => { await supabase.auth.signOut(); navigate('/admin/login') }}
          className="text-muted text-sm mt-6 hidden md:block"
        >
          Cerrar sesión
        </button>
      </aside>

      <main className="flex-1 p-5 md:p-8 max-w-4xl">
        <Outlet />
      </main>
    </div>
  )
}
