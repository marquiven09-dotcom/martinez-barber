# Martinez Barber — Web + reservas + panel de administración

Guía paso a paso, pensada para alguien que empieza desde cero. Sigue el
orden exacto. No hace falta pagar nada (excepto si más adelante quieres
un dominio propio en vez de uno gratuito de Vercel).

Tiempo estimado si es tu primera vez con estas herramientas: 2-3 horas.

---

## 0. Antes de empezar: cuentas que necesitas crear (todas gratis)

1. **GitHub** (github.com) — para guardar el código.
2. **Supabase** (supabase.com) — base de datos + backend.
3. **Vercel** (vercel.com) — para publicar la web.
4. **Resend** (resend.com) — para enviar los emails.
5. **Google Cloud Console** (console.cloud.google.com) — para Google Calendar.
   Usa la cuenta de Gmail que ya tenéis.

---

## 1. Subir el proyecto a GitHub

1. Crea una cuenta en github.com si no tienes.
2. Crea un repositorio nuevo, por ejemplo `martinez-barber` (puede ser privado).
3. Sube TODOS los archivos de esta carpeta a ese repositorio. Si nunca has
   usado GitHub: en la página del repo vacío verás un botón
   **"uploading an existing file"** — arrastra ahí todos los archivos y carpetas.

---

## 2. Crear el proyecto en Supabase

1. Entra en supabase.com → **New project**.
2. Ponle nombre `martinez-barber`, elige una contraseña de base de datos
   (guárdala en un sitio seguro) y la región **más cercana a España**
   (por ejemplo, Frankfurt/eu-central).
3. Espera 1-2 minutos a que se cree.

### 2.1 Crear las tablas (el "esqueleto" de la base de datos)

1. En el menú lateral, entra en **SQL Editor**.
2. Abre el archivo `supabase/migrations/0001_init.sql` de este proyecto,
   copia TODO su contenido y pégalo en el SQL Editor. Pulsa **Run**.
3. Haz lo mismo con `supabase/migrations/0002_booking_function.sql`.

Si todo ha ido bien, en **Table Editor** verás las tablas: `services`,
`business_hours`, `closed_days`, `blocked_times`, `bookings`, `reviews`,
`settings`, `google_tokens`.

### 2.2 Crear tu usuario de administrador (para entrar al panel)

1. Ve a **Authentication → Users → Add user**.
2. Pon tu email y una contraseña. Marca "Auto Confirm User".
3. Con ese email y contraseña entrarás luego en `/admin/login`.

### 2.3 Apuntar tus claves

Ve a **Project Settings → API**. Ahí verás:
- **Project URL** → la necesitarás como `SUPABASE_URL`.
- **anon / public key** → la necesitarás como `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **service_role key** → la necesitarás como `SUPABASE_SERVICE_ROLE_KEY`
  (¡esta es secreta, no la compartas ni la subas a GitHub!).

---

## 3. Desplegar las Edge Functions (el "backend")

Esto se hace desde tu ordenador con la Supabase CLI. Instrucciones para
Windows/Mac/Linux:

1. Instala Node.js si no lo tienes (nodejs.org, versión LTS).
2. Abre una terminal dentro de la carpeta del proyecto y ejecuta:
   ```
   npm install -g supabase
   supabase login
   supabase link --project-ref TU_PROJECT_REF
   ```
   (El `TU_PROJECT_REF` lo ves en la URL de tu proyecto de Supabase,
   algo como `abcdefghijk`.)

3. Configura los "secrets" (claves privadas que usan las funciones).
   Sustituye cada valor por el tuyo real:
   ```
   supabase secrets set GOOGLE_CLIENT_ID=xxxx
   supabase secrets set GOOGLE_CLIENT_SECRET=xxxx
   supabase secrets set GOOGLE_REDIRECT_URI=https://TU-PROYECTO.supabase.co/functions/v1/google-oauth-callback
   supabase secrets set GOOGLE_CALENDAR_ID=primary
   supabase secrets set EMAIL_API_KEY=xxxx
   supabase secrets set EMAIL_FROM="Martinez Barber <reservas@tudominio.com>"
   supabase secrets set SITE_URL=https://martinez-barber.vercel.app
   ```
   (`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya están disponibles
   automáticamente dentro de las funciones, no hace falta configurarlas.)

   Todavía no tienes las claves de Google ni de Resend — las consigues en
   los pasos 4 y 5. Puedes volver aquí después.

4. Sube las funciones:
   ```
   supabase functions deploy get-available-slots
   supabase functions deploy book-appointment
   supabase functions deploy send-email
   supabase functions deploy send-reminder-emails
   supabase functions deploy cancel-appointment
   supabase functions deploy google-oauth-start
   supabase functions deploy google-oauth-callback
   ```

---

## 4. Configurar Google Calendar

1. Ve a console.cloud.google.com y crea un proyecto nuevo (arriba a la izquierda).
2. Ve a **APIs y servicios → Biblioteca**, busca "Google Calendar API" y
   pulsa **Habilitar**.
3. Ve a **APIs y servicios → Pantalla de consentimiento OAuth**:
   - Tipo de usuario: **Externo**.
   - Rellena nombre de la app ("Martinez Barber"), tu email de contacto.
   - En "Usuarios de prueba" añade el email de Gmail que usará Darío para
     el calendario. (Como sois solo vosotros usándolo, no hace falta
     publicar la app ni pasar la revisión de Google.)
4. Ve a **APIs y servicios → Credenciales → Crear credenciales →
   ID de cliente de OAuth**:
   - Tipo de aplicación: **Aplicación web**.
   - En "URI de redirección autorizados" añade exactamente:
     `https://TU-PROYECTO.supabase.co/functions/v1/google-oauth-callback`
5. Copia el **Client ID** y el **Client Secret** que te da Google y
   configúralos con `supabase secrets set` (paso 3.3 de arriba).

### Conectar el calendario desde el panel

1. Entra en tu panel (`/admin`) → **Sistema**.
2. Pulsa **"Conectar Google Calendar"**.
3. Inicia sesión con la cuenta de Gmail de Darío y acepta los permisos.
4. Deberías volver al panel y ver "🟢 Conectado".

---

## 5. Configurar el envío de emails (Resend)

1. Crea cuenta en resend.com (plan gratuito: 3.000 emails/mes).
2. Ve a **API Keys → Create API Key**, cópiala.
3. Ve a **Domains → Add Domain** y sigue sus instrucciones para verificar
   un dominio (añadir unos registros DNS). Si todavía no tienes dominio
   propio, Resend también permite enviar desde su dominio de pruebas
   mientras desarrollas, pero para producción real necesitarás un
   dominio verificado.
4. Configura:
   ```
   supabase secrets set EMAIL_API_KEY=tu_api_key_de_resend
   supabase secrets set EMAIL_FROM="Martinez Barber <reservas@tudominio.com>"
   ```

---

## 6. Programar los recordatorios automáticos

1. En Supabase, ve a **SQL Editor**.
2. Abre `supabase/cron_setup.sql`, sustituye `TU-PROYECTO` y
   `TU_SERVICE_ROLE_KEY` por los tuyos reales, y ejecútalo.

Esto hace que cada 30 minutos se compruebe si hay citas que necesitan
recordatorio (por defecto, 24h antes) y se envíen automáticamente.

---

## 7. Publicar la web (frontend) en Vercel

1. Entra en vercel.com con tu cuenta de GitHub.
2. **Add New → Project**, elige el repositorio `martinez-barber`.
3. En "Environment Variables" añade:
   - `VITE_SUPABASE_URL` = tu Project URL de Supabase
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = tu clave anon/public
4. Pulsa **Deploy**. En 1-2 minutos tendrás una URL tipo
   `https://martinez-barber.vercel.app`.

Con eso, la web pública ya funciona. Actualiza `SITE_URL` en los secrets
de Supabase (paso 3.3) con esta URL real y vuelve a desplegar
`google-oauth-callback` si la cambiaste.

---

## 8. Cómo usar el día a día (sin tocar código)

- **Entrar al panel**: ve a `tuweb.vercel.app/admin/login` y entra con el
  email/contraseña que creaste en el paso 2.2.
- **Cambiar precios o duraciones**: Panel → Horarios y servicios → Servicios.
- **Cambiar horario habitual**: Panel → Horarios y servicios → Horarios.
- **Cerrar un día o poner vacaciones**: Panel → Horarios y servicios →
  Días cerrados.
- **Bloquear una hora concreta**: Panel → Horarios y servicios →
  Bloquear horas.
- **Ver o cancelar citas**: Panel → Citas.
- **Añadir una cita a mano** (por ejemplo, si el cliente escribe por
  WhatsApp): Panel → Citas → "+ Añadir cita manual".
- **Gestionar reseñas**: Panel → Reseñas.
- **Ver si todo funciona (Google/Email)**: Panel → Sistema.

---

## 9. Cómo hacer una prueba completa

1. Abre tu web publicada y pulsa **"Pedir cita →"**.
2. Elige un servicio, confirma el profesional, elige un día a más de 24h
   vista, elige una hora, rellena tus propios datos con un email al que
   tengas acceso, y confirma.
3. Deberías ver la pantalla "Tu reserva ha sido confirmada".
4. Revisa tu correo: debería llegar el email de confirmación en menos
   de un minuto.
5. Si tienes Google Calendar conectado, revisa el calendario de Darío:
   debería aparecer el evento "Cita - MARTINEZ BARBER - [tu nombre]".
6. Entra al panel → Citas → Hoy o Próximas, y comprueba que aparece.
7. Prueba a cancelarla desde el panel: debería desaparecer del calendario
   de Google y llegarte un email de cancelación.

Si algo falla, entra en Panel → Sistema para ver el estado de cada pieza.

---

## 10. Estructura del proyecto (por si algún día quieres tocar código)

```
src/                      → la web pública (React)
  pages/Home.jsx           → página de inicio (precios, cortes, reseñas, ubicación)
  pages/Booking.jsx        → el flujo completo de reserva
  admin/                   → todo el panel privado
supabase/
  migrations/               → estructura de la base de datos (SQL)
  functions/                → el backend real (Edge Functions)
    _shared/availability.ts → ÚNICA función que calcula huecos libres
    book-appointment/        → crea una reserva de forma segura
    send-email/               → única función que envía todos los emails
    send-reminder-emails/     → tarea programada de recordatorios
    google-oauth-start/       → conecta Google Calendar
    google-oauth-callback/    → recibe la respuesta de Google
    cancel-appointment/       → cancela una cita (solo admin)
```

---

## 11. Limitaciones que debes conocer

- El dominio gratuito de Vercel (`.vercel.app`) es perfectamente
  funcional, pero si más adelante quieres `martinezbarber.com` o similar,
  eso sí tiene un coste (10-15€/año aprox.) — lo puedes comprar cuando
  quieras y añadirlo en Vercel en dos minutos, sin tocar nada más.
- Resend en su plan gratuito requiere verificar un dominio propio para
  enviar a cualquier destinatario en producción real. Mientras no tengas
  dominio, puedes seguir probando con el dominio de pruebas de Resend,
  pero solo llegará a la cuenta de email con la que te registraste en Resend.
- Google exige "usuarios de prueba" añadidos a mano mientras la app no
  esté "verificada" públicamente. Como solo la usa Darío, esto no es un
  problema: simplemente añade su Gmail como usuario de prueba (paso 4.3)
  y no expira.
