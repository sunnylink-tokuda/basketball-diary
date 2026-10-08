-- Apply to a staging project first. Existing records must have a unique text
-- date key and a JSON/JSONB data column (as required by the current app).
begin;

create table public.chappy_advice (
  date text primary key references public.records(date) on delete cascade,
  source_data jsonb not null,
  advice jsonb,
  request_id uuid,
  attempted_at timestamptz not null default now(),
  generated_at timestamptz,
  check (advice is null or (
    jsonb_typeof(advice) = 'object' and
    advice ?& array['good','focus','mission'] and
    jsonb_typeof(advice->'good') = 'string' and
    jsonb_typeof(advice->'focus') = 'string' and
    jsonb_typeof(advice->'mission') = 'string' and
    length(advice->>'good') between 1 and 120 and
    length(advice->>'focus') between 1 and 120 and
    length(advice->>'mission') between 1 and 120
  ))
);
create table public.chappy_usage (
  user_id uuid not null,
  day date not null,
  attempts integer not null check (attempts between 0 and 30),
  primary key (user_id, day)
);
alter table public.chappy_advice enable row level security;
alter table public.chappy_usage enable row level security;
-- No browser policies. Only the authenticated, allowlisted Edge Function uses
-- service_role. API grants and RLS are separate protections.
revoke all on public.chappy_advice, public.chappy_usage from public, anon, authenticated;
grant all on public.chappy_advice, public.chappy_usage to service_role;

create function public.chappy_current_advice(p_date text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select a.advice from public.chappy_advice a
  join public.records r on r.date = a.date
  where a.date = p_date and a.source_data = r.data::jsonb;
$$;

create function public.chappy_claim(p_date text, p_source jsonb, p_request uuid, p_user uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  v_source jsonb;
  v_row public.chappy_advice%rowtype;
  v_count integer;
begin
  -- Lock order is always record -> advice -> usage. The transaction ends
  -- before the external API call; the request UUID acts as a short lease.
  select data::jsonb into v_source from public.records where date = p_date for update;
  if not found or v_source is distinct from p_source then return 'changed'; end if;
  select * into v_row from public.chappy_advice where date = p_date for update;
  if found then
    if v_row.source_data = p_source and v_row.advice is not null then return 'ready'; end if;
    if v_row.attempted_at > now() - interval '60 seconds' then return 'busy'; end if;
  end if;
  insert into public.chappy_usage(user_id,day,attempts) values(p_user,current_date,1)
  on conflict(user_id,day) do update set attempts = public.chappy_usage.attempts + 1
    where public.chappy_usage.attempts < 30
  returning attempts into v_count;
  if not found then return 'limited'; end if;
  insert into public.chappy_advice(date,source_data,request_id,attempted_at)
  values(p_date,p_source,p_request,now())
  on conflict(date) do update set source_data = excluded.source_data,
    request_id = excluded.request_id, attempted_at = excluded.attempted_at,
    advice = null, generated_at = null;
  return 'claimed';
end;
$$;

create function public.chappy_finish(p_date text, p_request uuid, p_advice jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_source jsonb;
begin
  select data::jsonb into v_source from public.records where date = p_date for update;
  if not found then return false; end if;
  update public.chappy_advice set advice = p_advice, generated_at = now(), request_id = null
  where date = p_date and request_id = p_request and source_data = v_source;
  return found;
end;
$$;

revoke all on function public.chappy_current_advice(text) from public, anon, authenticated;
revoke all on function public.chappy_claim(text,jsonb,uuid,uuid) from public, anon, authenticated;
revoke all on function public.chappy_finish(text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.chappy_current_advice(text) to service_role;
grant execute on function public.chappy_claim(text,jsonb,uuid,uuid) to service_role;
grant execute on function public.chappy_finish(text,uuid,jsonb) to service_role;
commit;
