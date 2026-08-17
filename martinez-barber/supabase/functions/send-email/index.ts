// ============================================================
// ÚNICA función dedicada a enviar correos (confirmación,
// recordatorio y cancelación). La llaman book-appointment,
// send-reminder-emails y cancel-appointment.
//
// Proveedor elegido: Resend (resend.com).
// Motivo: API HTTP muy simple (una sola llamada fetch), plan
// gratuito de 3.000 emails/mes y 100/día -- de sobra para una
// barbería -- y no requiere servidor SMTP propio.
// ============================================================
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

function formatFechaBonita(fecha: string): string {
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}

function formatDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function baseTemplate(titulo: string, cuerpoHtml: string): string {
  return `
  <div style="background:#0a0a0a;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#141414;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">
      <div style="padding:28px 24px 4px;text-align:center;">
        <div style="color:#f2f1ed;font-size:20px;letter-spacing:2px;font-weight:700;">MARTINEZ BARBER</div>
      </div>
      <div style="padding:20px 24px 28px;color:#e9e8e4;font-size:15px;line-height:1.6;">
        <h1 style="font-size:18px;color:#f2f1ed;margin:0 0 16px;">${titulo}</h1>
        ${cuerpoHtml}
        <hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0;" />
        <p style="color:#9a988f;font-size:13px;margin:4px 0;">📍 Av. Albufera 66, Silla, Valencia</p>
        <p style="color:#9a988f;font-size:13px;margin:4px 0;">📞 +34 622 56 14 94</p>
      </div>
    </div>
  </div>`;
}

function detalleReserva(b: Record<string, unknown>): string {
  return `
    <table style="width:100%;font-size:14px;color:#e9e8e4;">
      <tr><td style="padding:4px 0;color:#9a988f;">Servicio</td><td style="text-align:right;">${b.servicio_nombre}</td></tr>
      <tr><td style="padding:4px 0;color:#9a988f;">Fecha</td><td style="text-align:right;">${formatFechaBonita(b.fecha as string)}</td></tr>
      <tr><td style="padding:4px 0;color:#9a988f;">Hora</td><td style="text-align:right;">${(b.hora_inicio as string).slice(0,5)}</td></tr>
      <tr><td style="padding:4px 0;color:#9a988f;">Duración</td><td style="text-align:right;">${formatDuracion(b.duracion_minutos as number)}</td></tr>
      <tr><td style="padding:4px 0;color:#9a988f;">Precio</td><td style="text-align:right;">${b.precio} €</td></tr>
      <tr><td style="padding:4px 0;color:#9a988f;">Profesional</td><td style="text-align:right;">Darío</td></tr>
    </table>`;
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    // Esta función solo la llaman otras Edge Functions con la service role,
    // nunca el navegador directamente.
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "__none__")) {
      return jsonResponse({ error: "No autorizado" }, 401);
    }

    const { tipo, booking_id } = await req.json();
    const supabase = getSupabaseAdmin();

    const { data: booking, error } = await supabase
      .from("bookings").select("*").eq("id", booking_id).maybeSingle();
    if (error || !booking) return jsonResponse({ error: "Reserva no encontrada" }, 404);

    let asunto = "";
    let html = "";
    let statusField: "confirmation_email_status" | "reminder_email_status" | null = null;

    if (tipo === "confirmacion") {
      asunto = "Tu reserva en MARTINEZ BARBER ha sido confirmada";
      html = baseTemplate(
        "Tu reserva ha sido confirmada",
        `<p>Hola, ${booking.nombre}.</p><p>Tu cita en MARTINEZ BARBER ha quedado confirmada.</p>${detalleReserva(booking)}<p style="margin-top:20px;">Si necesitas cancelar o modificar tu cita, llámanos al +34 622 56 14 94.</p>`,
      );
      statusField = "confirmation_email_status";
    } else if (tipo === "recordatorio") {
      asunto = "Recordatorio: tu cita en MARTINEZ BARBER es mañana";
      html = baseTemplate(
        "Te esperamos pronto",
        `<p>Hola, ${booking.nombre}. Este es un recordatorio de tu próxima cita:</p>${detalleReserva(booking)}<p style="margin-top:20px;">Si necesitas cancelar o modificar tu cita, llámanos al +34 622 56 14 94.</p>`,
      );
      statusField = "reminder_email_status";
    } else if (tipo === "cancelacion") {
      asunto = "Tu cita en MARTINEZ BARBER ha sido cancelada";
      html = baseTemplate(
        "Tu cita ha sido cancelada",
        `<p>Hola, ${booking.nombre}.</p><p>Tu cita del ${formatFechaBonita(booking.fecha)} a las ${booking.hora_inicio.slice(0,5)} ha sido cancelada.</p><p style="margin-top:20px;">Si quieres reservar otra hora, llámanos al +34 622 56 14 94 o entra de nuevo en la web.</p>`,
      );
    } else {
      return jsonResponse({ error: "Tipo de email desconocido" }, 400);
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("EMAIL_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM"),
        to: [booking.email],
        subject: asunto,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Error enviando email con Resend:", errText);
      if (statusField) {
        await supabase.from("bookings").update({ [statusField]: "failed" }).eq("id", booking_id);
      }
      await supabase.from("settings").update({
        valor: JSON.stringify(`Fallo al enviar email (${tipo}): ${errText}`.slice(0, 500)),
      }).eq("clave", "email_last_error");
      return jsonResponse({ error: "No se pudo enviar el email" }, 502);
    }

    if (statusField) {
      await supabase.from("bookings").update({ [statusField]: "sent" }).eq("id", booking_id);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: "Error interno enviando el email" }, 500);
  }
});
