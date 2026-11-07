-- No-login family mode: apply AFTER chappy-advice.sql, chappy-growth.sql,
-- chappy-oct09-revision.sql and chappy-goal-cycle.sql. Additive only: no
-- existing rows, advice or owner mappings are rewritten.
begin;

-- The diary belongs to one family. Its owner id is the user with the most
-- registered records; ties break to the smallest user_id so the choice is
-- deterministic. Returns null when no owner has been registered yet.
create function chappy_internal.family_user() returns uuid
language sql stable security definer set search_path='' as $$
  select o.user_id from public.chappy_record_owners o
  group by o.user_id order by count(*) desc, o.user_id asc limit 1;
$$;
revoke all on function chappy_internal.family_user() from public,anon,authenticated;
grant execute on function chappy_internal.family_user() to service_role;

-- Thin public wrapper used by the Edge Function (service_role only).
create function public.chappy_family_user() returns uuid
language sql stable security invoker set search_path='' as $$
  select chappy_internal.family_user();
$$;
revoke all on function public.chappy_family_user() from public,anon,authenticated;
grant execute on function public.chappy_family_user() to service_role;

-- Owner registration without login: authenticated inserts keep the original
-- behaviour. Anonymous inserts (the no-login diary writes records with the
-- anon key) are attributed to the family user when one exists, so diaries
-- written without login stay readable by Chappy. Existing owner rows are
-- never reassigned (on conflict do nothing), and '__meta__' or other
-- non-date keys are still ignored.
create or replace function chappy_internal.register_owner() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_user uuid;
begin
  if new.date ~ '^\d{4}-\d{2}-\d{2}$' then
    if auth.uid() is not null and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false then
      v_user := auth.uid();
    else
      v_user := chappy_internal.family_user();
    end if;
    if v_user is not null then
      insert into public.chappy_record_owners(date,user_id) values(new.date,v_user) on conflict(date) do nothing;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function chappy_internal.register_owner() from public,anon,authenticated;
commit;
