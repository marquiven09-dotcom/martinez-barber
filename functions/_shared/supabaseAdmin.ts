import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Este cliente usa la SERVICE_ROLE_KEY: se salta la Row Level Security.
// Por eso SOLO se usa dentro de Edge Functions (backend), nunca en el
// navegador. Las Edge Functions ya tienen SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY disponibles automáticamente como variables
// de entorno del proyecto, no hace falta configurarlas a mano.
export function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}
