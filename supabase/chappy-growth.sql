-- Incremental setup: apply AFTER chappy-advice.sql. No records/advice backfill.
begin;
create table public.chappy_record_owners (
  date text primary key references public.records(date) on delete cascade,
  user_id uuid not null
);
create index chappy_record_owners_user_date on public.chappy_record_owners(user_id,date);
alter table public.chappy_record_owners enable row level security;
revoke all on public.chappy_record_owners from public,anon,authenticated;
grant select on public.chappy_record_owners to authenticated;
create policy chappy_owner_self on public.chappy_record_owners for select to authenticated
using ((select auth.uid())=user_id);
grant all on public.chappy_record_owners to service_role;

create table public.chappy_growth_advice (
  user_id uuid not null,
  date text not null,
  source_data jsonb not null,
  advice jsonb,
  request_id uuid,
  attempted_at timestamptz not null default now(),
  generated_at timestamptz,
  analysis_version text not null default 'guard-growth-v1',
  primary key(user_id,date),
  check (advice is null or (jsonb_typeof(advice)='object'
    and advice ?& array['good','focus','mission','growth']
    and jsonb_typeof(advice->'good')='string' and length(advice->>'good') between 1 and 120
    and jsonb_typeof(advice->'focus')='string' and length(advice->>'focus') between 1 and 120
    and jsonb_typeof(advice->'mission')='string' and length(advice->>'mission') between 1 and 120))
);
alter table public.chappy_growth_advice enable row level security;
revoke all on public.chappy_growth_advice from public,anon,authenticated;
grant select on public.chappy_growth_advice to authenticated;
create policy chappy_growth_self on public.chappy_growth_advice for select to authenticated
using ((select auth.uid())=user_id);
grant all on public.chappy_growth_advice to service_role;

-- Private trigger needs elevated privileges ONLY to register ownership of a
-- genuinely new authenticated insert. Existing records are never auto-claimed.
create schema if not exists chappy_internal;
revoke all on schema chappy_internal from public,anon,authenticated;
create function chappy_internal.register_owner() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
     and new.date ~ '^\d{4}-\d{2}-\d{2}$' then
    insert into public.chappy_record_owners(date,user_id) values(new.date,auth.uid()) on conflict(date) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function chappy_internal.register_owner() from public,anon,authenticated;
create trigger chappy_register_owner after insert on public.records
for each row execute function chappy_internal.register_owner();

create function chappy_internal.immutable_growth() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if old.advice is not null then raise exception 'Saved advice is immutable'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function chappy_internal.immutable_growth() from public,anon,authenticated;
create trigger chappy_growth_immutable before update or delete on public.chappy_growth_advice
for each row execute function chappy_internal.immutable_growth();

create function public.chappy_growth_record(p_user uuid,p_date text) returns jsonb
language sql stable security invoker set search_path='' as $$
  select r.data::jsonb from public.records r join public.chappy_record_owners o on o.date=r.date
  where o.user_id=p_user and r.date=p_date;
$$;

create function public.chappy_growth_saved(p_user uuid,p_date text) returns jsonb
language sql stable security invoker set search_path='' as $$
  select coalesce(
    (select a.advice from public.chappy_growth_advice a where a.user_id=p_user and a.date=p_date),
    (select a.advice from public.chappy_advice a where a.date=p_date)
  ) where exists(select 1 from public.chappy_record_owners o where o.date=p_date and o.user_id=p_user);
$$;

create function public.chappy_growth_history(p_user uuid,p_date text) returns jsonb
language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('date',h.date,'data',h.data,'advice',h.advice) order by h.date),'[]'::jsonb)
  from (
    select r.date,r.data::jsonb as data,public.chappy_growth_saved(p_user,r.date) as advice
    from public.chappy_record_owners o join public.records r on r.date=o.date
    where o.user_id=p_user and r.date >= ((p_date::date)-30)::text and r.date < p_date
      and r.date ~ '^\d{4}-\d{2}-\d{2}$'
      and exists(select 1 from public.chappy_record_owners mine where mine.date=p_date and mine.user_id=p_user)
    order by r.date desc limit 20
  ) h;
$$;

create function public.chappy_growth_claim(p_user uuid,p_date text,p_source jsonb,p_request uuid)
returns text language plpgsql security invoker set search_path='' as $$
declare v_source jsonb; v_row public.chappy_growth_advice%rowtype; v_count integer;
begin
  select r.data::jsonb into v_source from public.records r join public.chappy_record_owners o on o.date=r.date
  where r.date=p_date and o.user_id=p_user for update of r,o;
  if not found or v_source is distinct from p_source then return 'changed'; end if;
  if public.chappy_growth_saved(p_user,p_date) is not null then return 'ready'; end if;
  select * into v_row from public.chappy_growth_advice where user_id=p_user and date=p_date for update;
  if found and v_row.attempted_at > now()-interval '60 seconds' then return 'busy'; end if;
  insert into public.chappy_usage(user_id,day,attempts) values(p_user,current_date,1)
    on conflict(user_id,day) do update set attempts=public.chappy_usage.attempts+1
    where public.chappy_usage.attempts<30 returning attempts into v_count;
  if not found then return 'limited'; end if;
  insert into public.chappy_growth_advice(user_id,date,source_data,request_id)
    values(p_user,p_date,p_source,p_request)
    on conflict(user_id,date) do update set source_data=excluded.source_data,request_id=excluded.request_id,attempted_at=now()
    where public.chappy_growth_advice.advice is null;
  return 'claimed';
end;
$$;

create function public.chappy_growth_finish(p_user uuid,p_date text,p_request uuid,p_advice jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_source jsonb;
begin
  select r.data::jsonb into v_source from public.records r join public.chappy_record_owners o on o.date=r.date
  where r.date=p_date and o.user_id=p_user for update of r,o;
  if not found then return false; end if;
  if public.chappy_growth_saved(p_user,p_date) is not null then return false; end if;
  update public.chappy_growth_advice set advice=p_advice,generated_at=now(),request_id=null
    where user_id=p_user and date=p_date and request_id=p_request and source_data=v_source and advice is null;
  return found;
end;
$$;

revoke all on function public.chappy_growth_record(uuid,text) from public,anon,authenticated;
revoke all on function public.chappy_growth_saved(uuid,text) from public,anon,authenticated;
revoke all on function public.chappy_growth_history(uuid,text) from public,anon,authenticated;
revoke all on function public.chappy_growth_claim(uuid,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.chappy_growth_finish(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.chappy_growth_record(uuid,text) to service_role;
grant execute on function public.chappy_growth_saved(uuid,text) to service_role;
grant execute on function public.chappy_growth_history(uuid,text) to service_role;
grant execute on function public.chappy_growth_claim(uuid,text,jsonb,uuid) to service_role;
grant execute on function public.chappy_growth_finish(uuid,text,uuid,jsonb) to service_role;
commit;
