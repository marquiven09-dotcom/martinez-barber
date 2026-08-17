import { createClient } from '@supabase/supabase-js'

// Estas dos variables son PÚBLICAS a propósito (empiezan por VITE_,
// así Vite las incluye en el código que llega al navegador). La clave
// "publishable"/anon nunca permite saltarse la seguridad (RLS) de la
// base de datos: solo sirve para identificar el proyecto.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export const FUNCTIONS_URL = `${supabaseUrl}/functions/v1`
