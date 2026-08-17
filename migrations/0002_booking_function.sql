-- ============================================================
-- Función que crea una reserva de forma ATÓMICA.
-- Esto es lo que impide que dos personas se queden con la misma
-- hora si pulsan "reservar" a la vez (ver punto 27 del briefing).
--
-- Usa un "advisory lock" de Postgres por fecha: mientras se procesa
-- una reserva para un día concreto, cualquier otro intento de
-- reservar ESE MISMO día espera su turno (unos milisegundos) antes
-- de comprobar disponibilidad. Así el "hueco libre" que se comprobó
-- nunca puede quedar obsoleto entre la comprobación y el guardado.
-- ============================================================
create or replace function book_slot_atomic(
  p_nombre text,
  p_apellido text,
  p_telefono text,
  p_email text,
  p_servicio_id uuid,
  p_servicio_nombre text,
  p_precio numeric,
  p_duracion_minutos integer,
  p_fecha date,
  p_hora_inicio time,
  p_hora_fin time,
  p_margen_minutos integer,
  p_origen text default 'web'
) returns bookings
language plpgsql
as $$
declare
  v_conflict integer;
  v_booking bookings;
begin
  -- Bloqueo exclusivo por día: serializa todas las reservas de esa fecha
  perform pg_advisory_xact_lock(hashtext(p_fecha::text));

  -- Vuelve a comprobar solapes justo antes de insertar, ya con el lock activo
  select count(*) into v_conflict
  from bookings
  where fecha = p_fecha
    and estado in ('pending', 'confirmed')
    and (hora_inicio - (p_margen_minutos || ' minutes')::interval, hora_fin + (p_margen_minutos || ' minutes')::interval)
        overlaps (p_hora_inicio, p_hora_fin);

  if v_conflict > 0 then
    raise exception 'slot_taken' using errcode = 'P0001';
  end if;

  insert into bookings (
    nombre, apellido, telefono, email, servicio_id, servicio_nombre,
    precio, duracion_minutos, fecha, hora_inicio, hora_fin, estado, origen
  ) values (
    p_nombre, p_apellido, p_telefono, p_email, p_servicio_id, p_servicio_nombre,
    p_precio, p_duracion_minutos, p_fecha, p_hora_inicio, p_hora_fin, 'pending', p_origen
  )
  returning * into v_booking;

  return v_booking;
end;
$$;
