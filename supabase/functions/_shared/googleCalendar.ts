// ============================================================
// Integración con Google Calendar.
// Usa la API oficial (FreeBusy + Events) con OAuth2. El refresh_token
// se guarda en la tabla `google_tokens` (solo accesible con service_role,
// ver migración 0001_init.sql). Nunca se expone al frontend.
// ============================================================
import { getSupabaseAdmin } from "./supabaseAdmin.ts";
import { timeToMinutes } from "./availability.ts";

async function getValidAccessToken(): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data: tokenRow } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (!tokenRow || !tokenRow.refresh_token) return null; // Google no conectado todavía

  const expiresAt = tokenRow.access_token_expires_at
    ? new Date(tokenRow.access_token_expires_at).getTime()
    : 0;

  // Si el access_token todavía es válido (con 60s de margen), lo reutilizamos
  if (tokenRow.access_token && expiresAt - Date.now() > 60_000) {
    return tokenRow.access_token;
  }

  // Si no, pedimos uno nuevo a Google usando el refresh_token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    console.error("Error refrescando token de Google:", await res.text());
    return null;
  }

  const json = await res.json();
  const newExpiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();

  await supabase.from("google_tokens").update({
    access_token: json.access_token,
    access_token_expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);

  return json.access_token;
}

// Devuelve los periodos ocupados de Google Calendar para `fecha` (YYYY-MM-DD)
// como {start, end} en minutos desde medianoche, hora de Madrid.
export async function getBusyIntervalsFromGoogle(
  fecha: string,
  timezone: string,
): Promise<{ start: number; end: number }[]> {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return []; // Google Calendar no conectado: no bloquea nada

    const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";
    const timeMin = `${fecha}T00:00:00`;
    const timeMax = `${fecha}T23:59:59`;

    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin, timeMax, timeZone: timezone,
        items: [{ id: calendarId }],
      }),
    });

    if (!res.ok) {
      console.error("Error consultando FreeBusy de Google:", await res.text());
      return [];
    }

    const json = await res.json();
    const busy = json.calendars?.[calendarId]?.busy ?? [];

    return busy.map((b: { start: string; end: string }) => {
      const startLocal = toMadridTimeString(b.start, timezone);
      const endLocal = toMadridTimeString(b.end, timezone);
      return { start: timeToMinutes(startLocal), end: timeToMinutes(endLocal) };
    });
  } catch (err) {
    console.error("Fallo inesperado consultando Google Calendar:", err);
    return [];
  }
}

function toMadridTimeString(isoString: string, timezone: string): string {
  const d = new Date(isoString);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

export async function createGoogleEvent(booking: {
  nombre: string; apellido: string; telefono: string; email: string;
  servicio_nombre: string; precio: number; fecha: string;
  hora_inicio: string; hora_fin: string;
}): Promise<string | null> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null; // Google no conectado: seguimos sin evento

  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";
  const event = {
    summary: `Cita - MARTINEZ BARBER - ${booking.nombre} ${booking.apellido}`,
    description:
      `Cliente: ${booking.nombre} ${booking.apellido}\n` +
      `Teléfono: ${booking.telefono}\n` +
      `Email: ${booking.email}\n` +
      `Servicio: ${booking.servicio_nombre}\n` +
      `Precio: ${booking.precio} €`,
    location: "Av. Albufera 66, Silla, Valencia",
    start: { dateTime: `${booking.fecha}T${booking.hora_inicio}`, timeZone: "Europe/Madrid" },
    end: { dateTime: `${booking.fecha}T${booking.hora_fin}`, timeZone: "Europe/Madrid" },
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );

  if (!res.ok) {
    console.error("Error creando evento en Google Calendar:", await res.text());
    return null;
  }
  const json = await res.json();
  return json.id as string;
}

export async function deleteGoogleEvent(eventId: string): Promise<boolean> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return false;
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.ok || res.status === 410; // 410 = ya no existía, lo damos por bueno
}
