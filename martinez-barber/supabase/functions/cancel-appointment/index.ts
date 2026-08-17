// ============================================================
// Solo el panel de administración llama a esta función (requiere
// estar logueado con Supabase Auth). El cliente NUNCA puede
// cancelar desde la web pública (punto 33 del briefing).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { deleteGoogleEvent } from "../_shared/googleCalendar.ts";

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    // Comprobamos que quien llama está autenticado como admin (no es público)
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData?.user) {
      return jsonResponse({ error: "No autorizado" }, 401);
    }

    const { booking_id } = await req.json();
    const supabase = getSupabaseAdmin();

    const { data: booking, error } = await supabase
      .from("bookings").select("*").eq("id", booking_id).maybeSingle();
    if (error || !booking) return jsonResponse({ error: "Reserva no encontrada" }, 404);

    if (booking.estado === "cancelled") {
      return jsonResponse({ ok: true, note: "Ya estaba cancelada" });
    }

    if (booking.google_event_id) {
      try {
        await deleteGoogleEvent(booking.google_event_id);
      } catch (err) {
        console.error("No se pudo borrar el evento de Google Calendar:", err);
      }
    }

    await supabase.from("bookings").update({ estado: "cancelled" }).eq("id", booking_id);

    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ tipo: "cancelacion", booking_id }),
      });
    } catch (err) {
      console.error("Error enviando email de cancelación:", err);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: "Error cancelando la reserva" }, 500);
  }
});
