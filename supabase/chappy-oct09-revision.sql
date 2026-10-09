-- One replacement version for the owner's 2026-10-09 advice. Originals stay intact.
begin;
create table public.chappy_oct09_revision (
  user_id uuid not null,
  date text not null check(date='2026-10-09'),
  source_data jsonb not null,
  advice jsonb,
  request_id uuid,
  attempted_at timestamptz not null default now(),
  generated_at timestamptz,
  analysis_version text not null default 'grounded-comparison-v2',
  primary key(user_id,date),
  foreign key(user_id,date) references public.chappy_growth_advice(user_id,date),
  check(advice is null or (jsonb_typeof(advice)='object'
    and advice ?& array['good','focus','mission','growth','growth_status']
    and jsonb_typeof(advice->'good')='string' and length(advice->>'good') between 1 and 120
    and jsonb_typeof(advice->'focus')='string' and length(advice->>'focus') between 1 and 120
    and jsonb_typeof(advice->'mission')='string' and length(advice->>'mission') between 1 and 120))
);
alter table public.chappy_oct09_revision enable row level security;
revoke all on public.chappy_oct09_revision from public,anon,authenticated;
grant select on public.chappy_oct09_revision to authenticated;
create policy chappy_oct09_self on public.chappy_oct09_revision for select to authenticated
using((select auth.uid())=user_id);
grant all on public.chappy_oct09_revision to service_role;
create trigger chappy_oct09_immutable before update or delete on public.chappy_oct09_revision
for each row execute function chappy_internal.immutable_growth();

create function public.chappy_oct09_saved(p_user uuid,p_date text) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('advice',coalesce(
    (select a.advice from public.chappy_oct09_revision a where a.user_id=p_user and a.date=p_date),
    public.chappy_growth_saved(p_user,p_date)),
    'regenerated',exists(select 1 from public.chappy_oct09_revision a where a.user_id=p_user and a.date=p_date and a.advice is not null))
  where p_date='2026-10-09' and exists(select 1 from public.chappy_record_owners o where o.user_id=p_user and o.date=p_date);
$$;

create function public.chappy_oct09_claim(p_user uuid,p_date text,p_source jsonb,p_request uuid)
returns text language plpgsql security invoker set search_path='' as $$
declare v_source jsonb; v_row public.chappy_oct09_revision%rowtype; v_count integer;
begin
  if p_date<>'2026-10-09' then return 'forbidden'; end if;
  select r.data::jsonb into v_source from public.records r join public.chappy_record_owners o on o.date=r.date
    where r.date=p_date and o.user_id=p_user for update of r,o;
  if not found or v_source is distinct from p_source then return 'changed'; end if;
  if not exists(select 1 from public.chappy_growth_advice a where a.user_id=p_user and a.date=p_date and a.advice is not null) then return 'missing'; end if;
  select * into v_row from public.chappy_oct09_revision where user_id=p_user and date=p_date for update;
  if found then
    if v_row.advice is not null then return 'ready'; end if;
    if v_row.attempted_at>now()-interval '60 seconds' then return 'busy'; end if;
  end if;
  insert into public.chappy_usage(user_id,day,attempts) values(p_user,current_date,1)
    on conflict(user_id,day) do update set attempts=public.chappy_usage.attempts+1
    where public.chappy_usage.attempts<30 returning attempts into v_count;
  if not found then return 'limited'; end if;
  insert into public.chappy_oct09_revision(user_id,date,source_data,request_id)
    values(p_user,p_date,p_source,p_request)
    on conflict(user_id,date) do update set source_data=excluded.source_data,request_id=excluded.request_id,attempted_at=now()
    where public.chappy_oct09_revision.advice is null;
  return 'claimed';
end;
$$;

create function public.chappy_oct09_finish(p_user uuid,p_date text,p_request uuid,p_advice jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_source jsonb;
begin
  if p_date<>'2026-10-09' then return false; end if;
  select r.data::jsonb into v_source from public.records r join public.chappy_record_owners o on o.date=r.date
    where r.date=p_date and o.user_id=p_user for update of r,o;
  if not found then return false; end if;
  update public.chappy_oct09_revision set advice=p_advice,generated_at=now(),request_id=null
    where user_id=p_user and date=p_date and request_id=p_request and source_data=v_source and advice is null;
  return found;
end;
$$;
revoke all on function public.chappy_oct09_saved(uuid,text) from public,anon,authenticated;
revoke all on function public.chappy_oct09_claim(uuid,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.chappy_oct09_finish(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.chappy_oct09_saved(uuid,text) to service_role;
grant execute on function public.chappy_oct09_claim(uuid,text,jsonb,uuid) to service_role;
grant execute on function public.chappy_oct09_finish(uuid,text,uuid,jsonb) to service_role;
commit;
