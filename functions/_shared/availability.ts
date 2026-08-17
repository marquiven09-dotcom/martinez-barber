// ============================================================
// FUENTE ÚNICA DE VERDAD para calcular huecos disponibles.
// La usan tanto get-available-slots (para pintar la web) como
// book-appointment (para revalidar justo antes de guardar).
// No se debe duplicar esta lógica en ningún otro sitio.
// ============================================================
import { getSupabaseAdmin } from "./supabaseAdmin.ts";
import { getBusyIntervalsFromGoogle } from "./googleCalendar.ts";

const TIMEZONE = "Europe/Madrid";

interface Interval {
  start: number; // minutos desde las 00:00 de ese día, hora de Madrid
  end: number;
}

// Convierte "HH:MM:SS" o "HH:MM" a minutos desde medianoche
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Día de la semana (0=domingo..6=sábado) de una fecha "YYYY-MM-DD",
// calculado en la zona horaria de Madrid (no en UTC).
function weekdayInMadrid(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00`); // mediodía evita líos de DST
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  });
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[fmt.format(d)];
}

// "Ahora" expresado como minutos desde medianoche de `dateStr`, en hora
// de Madrid. Si "ahora" es un día distinto a dateStr, devuelve -Infinity
// o +Infinity según corresponda, para que las comparaciones funcionen.
function nowAsMinutesOnDate(dateStr: string): number {
  const nowMadridStr = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date()); // "YYYY-MM-DD HH:MM"
  const [todayStr, timeStr] = nowMadridStr.split(" ");
  if (todayStr === dateStr) return timeToMinutes(timeStr);
  return todayStr < dateStr ? -Infinity : Infinity;
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [sorted[0]];
  for (const cur of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export async function getAvailableSlots(
  fecha: string, // "YYYY-MM-DD"
  duracionMinutos: number,
): Promise<string[]> {
  const supabase = getSupabaseAdmin();

  // 1. ¿Día cerrado (festivo/vacaciones)?
  const { data: closed } = await supabase
    .from("closed_days")
    .select("id")
    .eq("fecha", fecha)
    .maybeSingle();
  if (closed) return [];

  // 2. Horario habitual de ese día de la semana
  const dow = weekdayInMadrid(fecha);
  const { data: hours } = await supabase
    .from("business_hours")
    .select("hora_inicio, hora_fin")
    .eq("dia_semana", dow)
    .eq("activo", true);
  if (!hours || hours.length === 0) return [];

  const windows: Interval[] = hours.map((h) => ({
    start: timeToMinutes(h.hora_inicio),
    end: timeToMinutes(h.hora_fin),
  }));

  // 3. Reservas ya existentes ese día (pending o confirmed cuentan como ocupado)
  const { data: bookings } = await supabase
    .from("bookings")
    .select("hora_inicio, hora_fin")
    .eq("fecha", fecha)
    .in("estado", ["pending", "confirmed"]);

  // 4. Horas bloqueadas manualmente desde el panel
  const { data: blocked } = await supabase
    .from("blocked_times")
    .select("hora_inicio, hora_fin")
    .eq("fecha", fecha);

  // 5. Ocupación real de Google Calendar (fuente de verdad externa)
  const googleBusy = await getBusyIntervalsFromGoogle(fecha, TIMEZONE);

  const { data: marginSetting } = await supabase
    .from("settings").select("valor").eq("clave", "slot_margin_minutes").maybeSingle();
  const margin = Number(marginSetting?.valor ?? 5);

  const { data: advanceSetting } = await supabase
    .from("settings").select("valor").eq("clave", "min_advance_hours").maybeSingle();
  const minAdvanceHours = Number(advanceSetting?.valor ?? 24);

  const busyRaw: Interval[] = [
    ...(bookings ?? []).map((b) => ({
      start: timeToMinutes(b.hora_inicio),
      end: timeToMinutes(b.hora_fin),
    })),
    ...(blocked ?? []).map((b) => ({
      start: timeToMinutes(b.hora_inicio),
      end: timeToMinutes(b.hora_fin),
    })),
    ...googleBusy,
  ];

  // Ampliamos cada intervalo ocupado con el margen de seguridad (antes y
  // después), así garantizamos el hueco mínimo entre citas sin tener que
  // comprobarlo aparte para cada candidato.
  const busy = mergeIntervals(
    busyRaw.map((b) => ({ start: b.start - margin, end: b.end + margin })),
  );

  // 6. Antelación mínima
  const minStart = nowAsMinutesOnDate(fecha) + minAdvanceHours * 60;

  // 7. Generar candidatos cada 5 minutos dentro de cada ventana horaria
  const STEP = 5;
  const slots: string[] = [];
  for (const w of windows) {
    for (let start = w.start; start + duracionMinutos <= w.end; start += STEP) {
      if (start < minStart) continue;
      const candidate: Interval = { start, end: start + duracionMinutos };
      const clash = busy.some((b) => overlaps(candidate, b));
      if (!clash) {
        const hh = String(Math.floor(start / 60)).padStart(2, "0");
        const mm = String(start % 60).padStart(2, "0");
        slots.push(`${hh}:${mm}`);
      }
    }
  }
  return slots;
}

export function minutesToTimeString(totalMinutes: number): string {
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mm = String(totalMinutes % 60).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

export { timeToMinutes, TIMEZONE };
