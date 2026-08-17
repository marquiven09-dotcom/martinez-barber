import WhatsAppButton from './WhatsAppButton.jsx'

export default function Footer() {
  return (
    <footer className="border-t border-line mt-16">
      <div className="max-w-5xl mx-auto px-5 py-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="font-display text-lg tracking-wide">MARTINEZ BARBER</div>
          <p className="text-muted text-sm mt-1">Av. Albufera 66, Silla, Valencia</p>
          <p className="text-muted text-sm">+34 622 56 14 94 · @martinez._ba.rber</p>
        </div>
        <WhatsAppButton />
      </div>
      <p className="text-center text-xs text-muted pb-6">
        © {new Date().getFullYear()} Martinez Barber
      </p>
    </footer>
  )
}
