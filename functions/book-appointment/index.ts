import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getAvailableSlots, minutesToTimeString, timeToMinutes } from "../_shared/availability.ts";
import { createGoogleEvent } from "../_shared/googleCalendar.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[0-9\s]{9,15}$/;

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    const body = await req.json();
    const { nombre, apellido, telefono, email, servicio_id, fecha, hora_inicio } = body;
    const origen = body.origen === 'manual' ? 'manual' : 'web';

    // ---------- Validación básica ----------
    if (!nombre || !apellido || !telefono || !email || !servicio_id || !fecha || !hora_inicio) {
      return jsonResponse({ error: "Faltan datos obligatorios" }, 400);
    }
    if (!EMAIL_RE.test(email)) return jsonResponse({ error: "Correo electrónico no válido" }, 400);
    if (!PHONE_RE.test(telefono)) return jsonResponse({ error: "Teléfono no válido" }, 400);

    const supabase = getSupabaseAdmin();

    // ---------- Precio y duración: SIEMPRE desde la base de datos ----------
    // Nunca nos fiamos de lo que mande el navegador para el precio/duración.
    const { data: servicio, error: servicioError } = await supabase
      .from("services")
      .select("id, nombre, precio, duracion_minutos, activo")
      .eq("id", servicio_id)
      .maybeSingle();

    if (servicioError || !servicio || !servicio.activo) {
      return jsonResponse({ error: "El servicio seleccionado no existe o no está activo" }, 400);
    }

    // ---------- Revalidar disponibilidad (por si acaso) ----------
    const slots = await getAvailableSlots(fecha, servicio.duracion_minutos);
    if (!slots.includes(hora_inicio)) {
      return jsonResponse(
        { error: "Lo sentimos, esa hora acaba de ser reservada. Elige otra." },
        409,
      );
    }

    const { data: marginSetting } = await supabase
      .from("settings").select("valor").eq("clave", "slot_margin_minutes").maybeSingle();
    const margin = Number(marginSetting?.valor ?? 5);

    const startMinutes = timeToMinutes(hora_inicio);
    const horaFin = minutesToTimeString(startMinutes + servicio.duracion_minutos);
    const horaInicioFull = minutesToTimeString(startMinutes);

    // ---------- Paso 1: crear la reserva de forma atómica (estado pending) ----------
    const { data: booking, error: bookingError } = await supabase.rpc("book_slot_atomic", {
      p_nombre: nombre,
      p_apellido: apellido,
      p_telefono: telefono,
      p_email: email,
      p_servicio_id: servicio.id,
      p_servicio_nombre: servicio.nombre,
      p_precio: servicio.precio,
      p_duracion_minutos: servicio.duracion_minutos,
      p_fecha: fecha,
      p_hora_inicio: horaInicioFull,
      p_hora_fin: horaFin,
      p_margen_minutos: margin,
      p_origen: origen,
    });

    if (bookingError) {
      if (bookingError.message?.includes("slot_taken")) {
        return jsonResponse(
          { error: "Lo sentimos, esa hora acaba de ser reservada. Elige otra." },
          409,
        );
      }
      console.error(bookingError);
      return jsonResponse(
        { error: "No hemos podido confirmar la cita. No te preocupes: no se ha creado ninguna reserva. Inténtalo de nuevo." },
        500,
      );
    }

    // ---------- Paso 2: crear evento en Google Calendar (si está conectado) ----------
    let googleEventId: string | null = null;
    try {
      googleEventId = await createGoogleEvent({
        nombre, apellido, telefono, email,
        servicio_nombre: servicio.nombre, precio: servicio.precio,
        fecha, hora_inicio: horaInicioFull, hora_fin: horaFin,
      });
    } catch (err) {
      console.error("Error creando evento de Google Calendar:", err);
      googleEventId = null;
    }

    // ---------- Paso 3: marcar como confirmada ----------
    await supabase
      .from("bookings")
      .update({ estado: "confirmed", google_event_id: googleEventId })
      .eq("id", booking.id);

    // ---------- Paso 4: disparar el email de confirmación (no bloqueante) ----------
    let emailStatus = "not_sent";
    try {
      const emailRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ tipo: "confirmacion", booking_id: booking.id }),
      });
      emailStatus = emailRes.ok ? "sent" : "failed";
    } catch (err) {
      console.error("Error invocando send-email:", err);
      emailStatus = "failed";
    }
    await supabase.from("bookings").update({ confirmation_email_status: emailStatus }).eq("id", booking.id);

    return jsonResponse({
      ok: true,
      booking: {
        id: booking.id,
        servicio: servicio.nombre,
        precio: servicio.precio,
        duracion_minutos: servicio.duracion_minutos,
        fecha, hora_inicio: horaInicioFull, hora_fin: horaFin,
        google_event_id: googleEventId,
      },
    });
  } catch (err) {
    console.error(err);
    return jsonResponse(
      { error: "No hemos podido confirmar la cita. No te preocupes: no se ha creado ninguna reserva. Inténtalo de nuevo." },
      500,
    );
  }
});
