/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0a',        // fondo principal, negro mate
        surface: '#141414',     // tarjetas
        surface2: '#1c1c1c',
        line: '#2a2a2a',        // bordes discretos
        bone: '#f2f1ed',        // blanco mate (texto principal)
        muted: '#9a988f',       // texto secundario
        gold: '#b99456',        // acento muy puntual (detalle premium)
      },
      fontFamily: {
        display: ['"Oswald"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
      },
      borderRadius: {
        pill: '999px',
      },
    },
  },
  plugins: [],
}
