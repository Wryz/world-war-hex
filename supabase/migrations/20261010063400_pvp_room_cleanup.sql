-- Rooms nobody has touched for a day are cleared away whenever a new room is opened (with their
-- members and secrets).

create or replace function public.create_room(p_name text, p_army jsonb, p_settings jsonb, p_secret text) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  code text;
begin
  if uid is null then
    raise exception 'Sign in first';
  end if;
  delete from public.rooms where updated_at < now() - interval '1 day';
  code := public.new_room_code();
  insert into public.rooms (id, host_id, settings) values (code, uid, coalesce(p_settings, '{}'::jsonb));
  insert into public.room_members (room_id, user_id, name, seat, color, army)
    values (code, uid, left(trim(p_name), 24), 0, 0, coalesce(p_army, '{}'::jsonb));
  insert into public.room_secrets (room_id, user_id, secret) values (code, uid, p_secret);
  return code;
end;
$$;
