// ============================================================
// Se ejecuta periódicamente (cron de Supabase, ver README para
// configurarlo). Busca citas confirmadas próximas que todavía no
// han recibido recordatorio y dispara el envío a través de la
// función send-email. Nunca envía dos veces el mismo recordatorio.
// ============================================================
import { jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (_req) => {
  const supabase = getSupabaseAdmin();

  const { data: setting } = await supabase
    .from("settings").select("valor").eq("clave", "reminder_hours_before").maybeSingle();
  const hoursBefore = Number(setting?.valor ?? 24);

  const now = new Date();
  const windowStart = new Date(now.getTime() + (hoursBefore - 0.5) * 3600 * 1000);
  const windowEnd = new Date(now.getTime() + (hoursBefore + 0.5) * 3600 * 1000);

  const { data: candidates, error } = await supabase
    .from("bookings")
    .select("id, fecha, hora_inicio")
    .eq("estado", "confirmed")
    .eq("reminder_email_status", "not_sent")
    .gte("fecha", now.toISOString().slice(0, 10));

  if (error) {
    console.error(error);
    return jsonResponse({ error: "Error buscando citas" }, 500);
  }

  let enviados = 0;
  let fallidos = 0;

  for (const b of candidates ?? []) {
    const startsAt = new Date(`${b.fecha}T${b.hora_inicio}`);
    if (startsAt >= windowStart && startsAt <= windowEnd) {
      try {
        const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ tipo: "recordatorio", booking_id: b.id }),
        });
        if (res.ok) enviados++; else fallidos++;
      } catch (err) {
        console.error("Error enviando recordatorio:", err);
        fallidos++;
      }
    }
  }

  return jsonResponse({ ok: true, enviados, fallidos, revisados: candidates?.length ?? 0 });
});
