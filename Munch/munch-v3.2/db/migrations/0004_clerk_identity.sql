-- 0004 — Clerk identity, saved area and profile resolution.
-- Idempotent. Run after 0003.
--
-- Identity model:
--   Clerk session JWT  ->  sub (user_…)
--                          -> profiles.clerk_user_id (unique, external mapping)
--                             -> profiles.id (internal key used by every FK)
--
-- The browser never sends profile_id. The edge function resolves it from the
-- verified token, so switching identity providers would only rewrite this
-- mapping — diner data keeps its internal key.

alter table profiles add column if not exists clerk_user_id text;
alter table profiles add column if not exists email text;
alter table profiles add column if not exists last_area_id text;
alter table profiles add column if not exists last_area_source text;
alter table profiles add column if not exists last_area_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_last_area_source_check'
  ) then
    alter table profiles
      add constraint profiles_last_area_source_check
      check (last_area_source is null or last_area_source in ('gps', 'manual', 'default'));
  end if;
end $$;

create unique index if not exists profiles_clerk_user_id_key
  on profiles (clerk_user_id);

comment on column profiles.clerk_user_id is
  'External Clerk user id (sub). Null only for the seeded demo profile.';
comment on column profiles.last_area_id is
  'Chosen neighbourhood. Survives 30-day location pruning because it is a preference, not a GPS fix.';
comment on column profiles.last_area_source is
  'How the area was chosen: gps, manual or default.';

/* --------------------------------------------------------------------------
   resolve_profile — upsert from the verified Clerk subject.
   -------------------------------------------------------------------------- */
create or replace function resolve_profile(
  p_clerk_user_id text,
  p_display_name text default 'Diner',
  p_email text default null
)
returns profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  result profiles;
  safe_name text;
begin
  if p_clerk_user_id is null or length(trim(p_clerk_user_id)) < 3 then
    raise exception 'clerk_user_id is required';
  end if;

  safe_name := nullif(left(coalesce(trim(p_display_name), ''), 80), '');

  insert into profiles (id, display_name, email, clerk_user_id)
  values (
    'p_' || replace(gen_random_uuid()::text, '-', ''),
    coalesce(safe_name, 'Diner'),
    nullif(trim(coalesce(p_email, '')), ''),
    p_clerk_user_id
  )
  on conflict (clerk_user_id) do update
    set display_name = coalesce(excluded.display_name, profiles.display_name),
        email = coalesce(excluded.email, profiles.email)
  returning * into result;

  return result;
end;
$fn$;

/* --------------------------------------------------------------------------
   save_user_area — manual/GPS/default area choice. No history row.
   -------------------------------------------------------------------------- */
create or replace function save_user_area(
  p_profile_id text,
  p_area_id text,
  p_source text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  snap jsonb;
begin
  if p_area_id is null or p_area_id !~ '^[a-z0-9][a-z0-9-]{0,63}$' then
    raise exception 'invalid area id';
  end if;
  if p_source not in ('gps', 'manual', 'default') then
    raise exception 'invalid area source';
  end if;

  update profiles
     set last_area_id = p_area_id,
         last_area_source = p_source,
         last_area_updated_at = now()
   where id = p_profile_id
   returning jsonb_build_object(
     'id', last_area_id,
     'source', last_area_source,
     'updated_at', last_area_updated_at
   ) into snap;

  if snap is null then
    raise exception 'profile not found';
  end if;

  return snap;
end;
$fn$;

/* --------------------------------------------------------------------------
   save_user_location — one atomic GPS write: history + latest snapshot.
   Map-centre searches must call save_user_area instead; their centre is not
   where the diner is.
   -------------------------------------------------------------------------- */
create or replace function save_user_location(
  p_profile_id text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m double precision default null,
  p_label text default null,
  p_area_id text default null,
  p_source text default 'gps'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  snap jsonb;
  history_source text;
begin
  if p_lat is null or p_lat < -90 or p_lat > 90 then
    raise exception 'lat out of range';
  end if;
  if p_lng is null or p_lng < -180 or p_lng > 180 then
    raise exception 'lng out of range';
  end if;
  if p_accuracy_m is not null and (p_accuracy_m < 0 or p_accuracy_m > 100000) then
    raise exception 'accuracy out of range';
  end if;
  if p_source not in ('gps', 'search') then
    raise exception 'invalid source';
  end if;
  if p_area_id is not null and p_area_id !~ '^[a-z0-9][a-z0-9-]{0,63}$' then
    raise exception 'invalid area id';
  end if;

  -- user_locations predates Clerk and uses 'map' for a search centre.
  history_source := case when p_source = 'search' then 'map' else 'gps' end;

  insert into user_locations (profile_id, lat, lng, accuracy_m, label, source)
  values (
    p_profile_id,
    p_lat,
    p_lng,
    p_accuracy_m,
    left(nullif(trim(coalesce(p_label, '')), ''), 120),
    history_source
  );

  update profiles
     set last_location = jsonb_build_object(
           'lat', p_lat,
           'lng', p_lng,
           'accuracy_m', p_accuracy_m,
           'label', left(nullif(trim(coalesce(p_label, '')), ''), 120),
           'area_id', p_area_id,
           'source', p_source,
           'captured_at', now()
         ),
         last_area_id = coalesce(p_area_id, last_area_id),
         last_area_source = case
           when p_area_id is not null then 'gps'
           else last_area_source
         end,
         last_area_updated_at = case
           when p_area_id is not null then now()
           else last_area_updated_at
         end
   where id = p_profile_id
   returning last_location into snap;

  if snap is null then
    raise exception 'profile not found';
  end if;

  return snap;
end;
$fn$;

/* --------------------------------------------------------------------------
   clear_user_location_history — user-initiated privacy action.
   -------------------------------------------------------------------------- */
create or replace function clear_user_location_history(p_profile_id text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  removed integer;
begin
  delete from user_locations
   where profile_id = p_profile_id;
  get diagnostics removed = row_count;

  update profiles
     set last_location = null
   where id = p_profile_id;

  return removed;
end;
$fn$;

/* --------------------------------------------------------------------------
   delete_user_profile — cascades to cravings, bookings, waitlists, history.
   -------------------------------------------------------------------------- */
create or replace function delete_user_profile(p_profile_id text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  removed integer;
begin
  delete from profiles where id = p_profile_id;
  get diagnostics removed = row_count;
  return removed > 0;
end;
$fn$;

revoke all on function resolve_profile(text, text, text) from public;
revoke all on function save_user_area(text, text, text) from public;
revoke all on function save_user_location(text, double precision, double precision, double precision, text, text, text) from public;
revoke all on function clear_user_location_history(text) from public;
revoke all on function delete_user_profile(text) from public;
