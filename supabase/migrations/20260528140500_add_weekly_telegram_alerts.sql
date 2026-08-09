create extension if not exists pg_cron;
create extension if not exists pg_net;

select
  cron.unschedule(jobid)
from cron.job
where jobname = 'telegram-weekly-alerts';

select
  cron.schedule(
    'telegram-weekly-alerts',
    '0 13 * * 6',
    $$
    select
      net.http_post(
        url := 'https://bebmdemttvdoaagwqdia.supabase.co/functions/v1/telegram-weekly-alerts',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := '{"source":"weekly-budget-goal-check","timeZone":"Asia/Ho_Chi_Minh"}'::jsonb
      ) as request_id;
    $$
  );

comment on extension pg_cron is 'Used for weekly Telegram budget/goal alerts.';
