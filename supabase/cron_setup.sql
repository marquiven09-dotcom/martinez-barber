-- ============================================================
-- Programa el envío automático de recordatorios cada 30 minutos.
-- EJECUTA ESTO A MANO en Supabase > SQL Editor DESPUÉS de haber
-- desplegado las Edge Functions (necesitas tu URL de proyecto y
-- tu service_role key reales, ver README paso "Recordatorios").
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'enviar-recordatorios-citas',
  '*/30 * * * *', -- cada 30 minutos
  $$
  select net.http_post(
    url := 'https://TU-PROYECTO.supabase.co/functions/v1/send-reminder-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer TU_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Para comprobar que está programado:
-- select * from cron.job;

-- Para eliminarlo si algún día hace falta:
-- select cron.unschedule('enviar-recordatorios-citas');
