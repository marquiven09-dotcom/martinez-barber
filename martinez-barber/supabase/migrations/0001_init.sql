-- ============================================================
-- MARTINEZ BARBER · Esquema de base de datos
-- Ejecuta este archivo completo en Supabase > SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- SERVICES ----------
create table services (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  precio numeric(6,2) not null check (precio >= 0),
  duracion_minutos integer not null check (duracion_minutos > 0),
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

insert into services (nombre, precio, duracion_minutos, orden) values
  ('Corte', 4.00, 60, 1),
  ('Corte + barba', 6.00, 80, 2),
  ('Corte + cejas', 4.50, 65, 3),
  ('Todo incluido', 7.00, 90, 4),
  ('Corte a domicilio', 10.00, 60, 5);

-- ---------- BUSINESS HOURS ----------
-- dia_semana: 0 = domingo ... 6 = sábado (estándar Postgres/JS)
create table business_hours (
  id uuid primary key default uuid_generate_v4(),
  dia_semana integer not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fin time not null,
  activo boolean not null default true,
  check (hora_fin > hora_inicio)
);

-- Lunes(1) a viernes(5): 16:00-20:00 | Sábado(6) y domingo(0): 10-13 y 16-20
insert into business_hours (dia_semana, hora_inicio, hora_fin) values
  (1, '16:00', '20:00'),
  (2, '16:00', '20:00'),
  (3, '16:00', '20:00'),
  (4, '16:00', '20:00'),
  (5, '16:00', '20:00'),
  (6, '10:00', '13:00'),
  (6, '16:00', '20:00'),
  (0, '10:00', '13:00'),
  (0, '16:00', '20:00');

-- ---------- CLOSED DAYS (festivos / vacaciones) ----------
create table closed_days (
  id uuid primary key default uuid_generate_v4(),
  fecha date not null unique,
  motivo text,
  created_at timestamptz not null default now()
);

-- ---------- BLOCKED TIMES (horas concretas bloqueadas) ----------
create table blocked_times (
  id uuid primary key default uuid_generate_v4(),
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  motivo text,
  created_at timestamptz not null default now(),
  check (hora_fin > hora_inicio)
);

-- ---------- BOOKINGS ----------
create table bookings (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  apellido text not null,
  telefono text not null,
  email text not null,
  servicio_id uuid not null references services(id),
  servicio_nombre text not null,   -- copia congelada en el momento de reservar
  precio numeric(6,2) not null,    -- copia congelada (nunca se fía del frontend)
  duracion_minutos integer not null,
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  estado text not null default 'pending'
    check (estado in ('pending', 'confirmed', 'cancelled', 'completed', 'error')),
  google_event_id text,
  confirmation_email_status text not null default 'not_sent'
    check (confirmation_email_status in ('not_sent', 'sent', 'failed')),
  reminder_email_status text not null default 'not_sent'
    check (reminder_email_status in ('not_sent', 'sent', 'failed', 'not_needed')),
  origen text not null default 'web' check (origen in ('web', 'manual')),
  created_at timestamptz not null default now()
);

-- Evita DOS reservas activas para la misma fecha+hora exacta a nivel de base de datos.
-- (la comprobación de solapes con distinta duración se hace en la Edge Function
--  dentro de una transacción, ver book-appointment/index.ts)
create unique index bookings_no_duplicate_slot
  on bookings (fecha, hora_inicio)
  where estado in ('pending', 'confirmed');

create index bookings_fecha_idx on bookings (fecha);

-- ---------- REVIEWS ----------
create table reviews (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  texto text not null,
  puntuacion integer not null check (puntuacion between 1 and 5),
  visible boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- SETTINGS (clave/valor genérico para configuración) ----------
create table settings (
  clave text primary key,
  valor jsonb not null,
  updated_at timestamptz not null default now()
);

insert into settings (clave, valor) values
  ('reminder_hours_before', '24'),
  ('min_advance_hours', '24'),
  ('slot_margin_minutes', '5'),
  ('google_calendar_connected', 'false'),
  ('google_calendar_email', 'null'),
  ('email_last_error', 'null');

-- ---------- GOOGLE_TOKENS ----------
-- Tabla separada y "sellada": tiene RLS activado pero NINGUNA policy,
-- así que ni el admin autenticado ni el público pueden leerla nunca
-- desde el navegador. Solo la service_role (usada por las Edge
-- Functions) puede tocarla, porque la service_role SIEMPRE se salta RLS.
create table google_tokens (
  id integer primary key default 1,
  refresh_token text,
  access_token text,
  access_token_expires_at timestamptz,
  connected_email text,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
alter table google_tokens enable row level security;
-- (sin policies a propósito: 0 acceso desde frontend, solo backend)

-- ============================================================
-- ROW LEVEL SECURITY
-- Regla general: el público (anon) solo puede LEER lo que debe
-- ver en la web pública. Todo lo demás (escribir, ver datos de
-- otros clientes, tokens de Google...) solo con service_role,
-- que usan las Edge Functions y el panel de admin autenticado.
-- ============================================================

alter table services enable row level security;
alter table business_hours enable row level security;
alter table closed_days enable row level security;
alter table blocked_times enable row level security;
alter table bookings enable row level security;
alter table reviews enable row level security;
alter table settings enable row level security;

-- Lectura pública de lo necesario para pintar la web y calcular huecos libres
create policy "public read services" on services for select using (activo = true);
create policy "public read business_hours" on business_hours for select using (activo = true);
create policy "public read closed_days" on closed_days for select using (true);
create policy "public read blocked_times" on blocked_times for select using (true);
create policy "public read visible reviews" on reviews for select using (visible = true);

-- IMPORTANTE: bookings NO tiene policy de lectura pública.
-- Así ningún visitante puede ver nombres/teléfonos/emails de otros clientes.
-- La web pública solo "sabe" qué horas están ocupadas a través de la
-- Edge Function get-available-slots (que usa la service_role internamente).

-- El resto de escrituras (crear reservas, cambiar precios, bloquear horas,
-- gestionar reseñas...) se hacen siempre desde Edge Functions o desde el
-- panel autenticado usando la service_role key, que se salta RLS.
-- Esto evita que alguien manipule precios/horarios desde el navegador.

-- ---------- Usuario admin ----------
-- El panel usa Supabase Auth (email + contraseña). Crea el usuario de Darío
-- desde Supabase Dashboard > Authentication > Users > Add user.
-- No se necesita tabla adicional: cualquier usuario autenticado en Auth
-- es, por diseño de este proyecto (uso de un único barbero), el admin.

-- Policies para que el admin autenticado pueda gestionar todo desde el panel
create policy "admin all services" on services for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin all business_hours" on business_hours for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin all closed_days" on closed_days for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin all blocked_times" on blocked_times for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin all bookings" on bookings for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin all reviews" on reviews for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin read settings" on settings for select
  using (auth.role() = 'authenticated');
create policy "admin update settings" on settings for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
