-- M2 incremental sync scheduler. Run once in Supabase Studio → SQL Editor,
-- AFTER 004_m2_broker_connections.sql and after the app is deployed (needs
-- a real, reachable APP_URL).
--
-- Uses pg_cron + pg_net (both free-tier Postgres extensions) instead of
-- Vercel Cron, since Vercel's free Hobby tier only runs cron jobs once a
-- day — nowhere near the ~5 minute sync target. pg_cron has no access to
-- app environment variables, so the URL and shared secret are baked
-- directly into this SQL; rotating the secret means re-running
-- cron.alter_job (or unschedule + reschedule), not just changing an env
-- var. BROKER_CRON_SHARED_SECRET below must match the same value set as
-- an env var on the Vercel deployment.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'm2-broker-sync',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'REPLACE_WITH_APP_URL/api/cron/broker-sync',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', 'REPLACE_WITH_BROKER_CRON_SHARED_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To check the job is registered:
--   select * from cron.job where jobname = 'm2-broker-sync';
-- To see recent run history:
--   select * from cron.job_run_details where jobname = 'm2-broker-sync' order by start_time desc limit 20;
-- To remove it:
--   select cron.unschedule('m2-broker-sync');
