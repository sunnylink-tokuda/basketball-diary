-- Additive, read-only service RPC. No diary/advice rows are changed.
begin;
create or replace function public.chappy_previous_goals(p_user uuid,p_date text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('date',latest.date,'goal',latest.goal) order by latest.date desc),'[]'::jsonb) from (
  select candidate.date,candidate.goal from (
    select o.date,coalesce(
      nullif(btrim(a.advice->>'priority_goal'),''),nullif(btrim(a.advice->>'mission'),''),
      nullif(btrim(g.advice->>'priority_goal'),''),nullif(btrim(g.advice->>'mission'),''),
      nullif(btrim(l.advice->>'mission'),'')) as goal
    from public.chappy_record_owners o
    join public.records r on r.date=o.date
    left join public.chappy_oct09_revision a on a.user_id=o.user_id and a.date=o.date
    left join public.chappy_growth_advice g on g.user_id=o.user_id and g.date=o.date
    left join public.chappy_advice l on l.date=o.date
    where o.user_id=p_user and o.date<p_date and o.date ~ '^\d{4}-\d{2}-\d{2}$'
  ) candidate
  where length(candidate.goal) between 1 and 120
  order by candidate.date desc limit 2
  ) latest;
$$;
revoke all on function public.chappy_previous_goals(uuid,text) from public,anon,authenticated;
grant execute on function public.chappy_previous_goals(uuid,text) to service_role;
commit;
