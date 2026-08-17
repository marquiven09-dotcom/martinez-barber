import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError('Correo o contraseña incorrectos.')
      return
    }
    navigate('/admin')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <form onSubmit={handleSubmit} className="max-w-sm w-full">
        <h1 className="font-display text-2xl mb-1 text-center">MARTINEZ BARBER</h1>
        <p className="text-muted text-sm text-center mb-8">Panel privado</p>

        <label className="text-sm text-muted mb-1 block">Correo</label>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
          className="w-full bg-surface border border-line rounded-xl px-4 py-3 mb-4 outline-none focus:border-gold"
        />
        <label className="text-sm text-muted mb-1 block">Contraseña</label>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
          className="w-full bg-surface border border-line rounded-xl px-4 py-3 mb-4 outline-none focus:border-gold"
        />

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
