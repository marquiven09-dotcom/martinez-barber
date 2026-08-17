import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { getAvailableSlots } from "../_shared/availability.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    const { servicio_id, fecha } = await req.json();
    if (!servicio_id || !fecha) {
      return jsonResponse({ error: "Faltan servicio_id o fecha" }, 400);
    }

    const supabase = getSupabaseAdmin();
    const { data: servicio, error } = await supabase
      .from("services")
      .select("duracion_minutos, activo")
      .eq("id", servicio_id)
      .maybeSingle();

    if (error || !servicio || !servicio.activo) {
      return jsonResponse({ error: "Servicio no válido" }, 400);
    }

    const slots = await getAvailableSlots(fecha, servicio.duracion_minutos);
    return jsonResponse({ slots });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: "Error calculando disponibilidad" }, 500);
  }
});
