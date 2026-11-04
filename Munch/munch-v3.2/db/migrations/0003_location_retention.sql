-- 0003 — 30-day location retention, daily pruning and a supporting index.
-- Idempotent; equivalent DDL is part of db/schema.sql.

create index if not exists user_locations_updated_at_idx
  on user_locations (updated_at);

create or replace function prune_user_locations(retention_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  removed integer;
  cutoff timestamptz;
begin
  if retention_days is null or retention_days < 1 then
    raise exception 'retention_days must be a positive integer';
  end if;

  cutoff := now() - make_interval(days => retention_days);

  delete from user_locations
  where updated_at < cutoff;
  get diagnostics removed = row_count;

  -- A stale "last known" snapshot should not outlive the history it summarises.
  update profiles
     set last_location = null
   where last_location is not null
     and jsonb_typeof(last_location -> 'updated_at') = 'string'
     and (last_location ->> 'updated_at') ~ '^\d{4}-\d{2}-\d{2}'
     and (last_location ->> 'updated_at')::timestamptz < cutoff;

  return removed;
end;
$fn$;

comment on function prune_user_locations(integer) is 'Deletes location history older than the retention window (default 30 days) and clears stale last_location snapshots. Returns deleted history rows.';
