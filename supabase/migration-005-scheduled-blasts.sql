-- Journal des envois programmés (blast SMS planifié, déclenché par cron VPS).
create table if not exists scheduled_blasts (
  id           uuid primary key default gen_random_uuid(),
  scheduled_at timestamptz not null,                 -- échéance (UTC ; saisie en heure de Paris)
  limit_count  int not null check (limit_count > 0),  -- nb de prospects à viser
  status       text not null default 'pending',       -- pending | running | done | failed | canceled
  result       jsonb,                                  -- {sent, failed, totalSegments, pool, targeted, error?}
  created_at   timestamptz not null default now(),
  executed_at  timestamptz
);

create index if not exists idx_scheduled_blasts_due on scheduled_blasts (status, scheduled_at);

-- Realtime (comme prospects/sms_messages). Ignore l'erreur si déjà publiée.
do $$ begin
  alter publication supabase_realtime add table scheduled_blasts;
exception when others then null;
end $$;
