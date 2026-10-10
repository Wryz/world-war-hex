-- Rooms for online battles between friends (src/lib/pvp/room.ts).
--
-- A host creates a room and shares its invite link; up to eight players join it with the army saved on
-- their own device (players are anonymous users). The host's game runs the battle and passes it on to
-- the others over the room's private Realtime channel, `room:<code>`, which only the room's members can
-- use. Each member also leaves a secret that only the host can read, and sends it with its orders, so
-- nobody can give orders as someone else.

create table public.rooms (
  id text primary key check (id ~ '^[A-Z2-9]{6}$'),
  host_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_members (
  room_id text not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  seat smallint not null check (seat between 0 and 7),
  color smallint not null check (color between 0 and 7),
  team smallint check (team between 0 and 7),
  -- The cards the member brings: { deck, cards, trees } from their saved profile
  army jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);

create table public.room_secrets (
  room_id text not null,
  user_id uuid not null,
  secret text not null check (char_length(secret) between 16 and 64),
  primary key (room_id, user_id),
  foreign key (room_id, user_id) references public.room_members (room_id, user_id) on delete cascade
);

create index room_members_user_idx on public.room_members (user_id);
create index rooms_host_idx on public.rooms (host_id);

-- Whether the signed-in user is in a room, or hosts it (security definer: the policies below use them,
-- and they must not run into the policies themselves)
create function public.is_room_member(code text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.room_members m where m.room_id = code and m.user_id = (select auth.uid()));
$$;

create function public.is_room_host(code text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.rooms r where r.id = code and r.host_id = (select auth.uid()));
$$;

create function public.touch_room() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger rooms_touch before update on public.rooms
for each row execute function public.touch_room();

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_secrets enable row level security;

-- Rooms: seen by their members; settings and status changed (or the room closed) by the host
create policy "members see their rooms" on public.rooms for select to authenticated
  using (public.is_room_member(id));
create policy "hosts update their rooms" on public.rooms for update to authenticated
  using (host_id = (select auth.uid())) with check (host_id = (select auth.uid()));
create policy "hosts close their rooms" on public.rooms for delete to authenticated
  using (host_id = (select auth.uid()));

-- Members: seen by the room; a member changes their own row (name, army, colour), the host anyone's
-- (teams, colours); a member leaves, or the host removes them
create policy "members see each other" on public.room_members for select to authenticated
  using (public.is_room_member(room_id));
create policy "members and hosts update members" on public.room_members for update to authenticated
  using (user_id = (select auth.uid()) or public.is_room_host(room_id))
  with check (user_id = (select auth.uid()) or public.is_room_host(room_id));
create policy "members leave, hosts remove" on public.room_members for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_room_host(room_id));

-- Secrets: each member sees their own, and the host everyone's
create policy "hosts and owners see secrets" on public.room_secrets for select to authenticated
  using (user_id = (select auth.uid()) or public.is_room_host(room_id));

grant select, update, delete on public.rooms to authenticated;
grant select, update, delete on public.room_members to authenticated;
grant select on public.room_secrets to authenticated;

-- A short code for a new room, from letters and digits that can't be mistaken for each other
create function public.new_room_code() returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where id = code);
  end loop;
  return code;
end;
$$;

-- Open a room as its host (seat 1); rooms left untouched for a day are cleared away
create function public.create_room(p_name text, p_army jsonb, p_settings jsonb, p_secret text) returns text
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

-- Join a room from its invite link: the first free seat and colour, while the room is still in its
-- lobby and has room (a member coming back keeps their seat, and can come back mid-battle)
create function public.join_room(p_code text, p_name text, p_army jsonb, p_secret text) returns smallint
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  room public.rooms;
  free_seat smallint;
  free_color smallint;
  existing smallint;
begin
  if uid is null then
    raise exception 'Sign in first';
  end if;
  select * into room from public.rooms where id = upper(p_code) for update;
  if room.id is null then
    raise exception 'No such room';
  end if;
  select seat into existing from public.room_members where room_id = room.id and user_id = uid;
  if existing is not null then
    if room.status = 'lobby' then
      update public.room_members set name = left(trim(p_name), 24), army = coalesce(p_army, army)
        where room_id = room.id and user_id = uid;
    end if;
    insert into public.room_secrets (room_id, user_id, secret) values (room.id, uid, p_secret)
      on conflict (room_id, user_id) do nothing;
    return existing;
  end if;
  if room.status <> 'lobby' then
    raise exception 'The battle has already begun';
  end if;
  select min(s) into free_seat from generate_series(0, 7) s
    where not exists (select 1 from public.room_members m where m.room_id = room.id and m.seat = s);
  if free_seat is null then
    raise exception 'The room is full';
  end if;
  select min(c) into free_color from generate_series(0, 7) c
    where not exists (select 1 from public.room_members m where m.room_id = room.id and m.color = c);
  insert into public.room_members (room_id, user_id, name, seat, color, army)
    values (room.id, uid, left(trim(p_name), 24), free_seat, coalesce(free_color, free_seat), coalesce(p_army, '{}'::jsonb));
  insert into public.room_secrets (room_id, user_id, secret) values (room.id, uid, p_secret);
  update public.rooms set updated_at = now() where id = room.id;
  return free_seat;
end;
$$;

revoke execute on function public.create_room(text, jsonb, jsonb, text) from public, anon;
revoke execute on function public.join_room(text, text, jsonb, text) from public, anon;
revoke execute on function public.new_room_code() from public, anon, authenticated;
revoke execute on function public.is_room_member(text) from public, anon;
revoke execute on function public.is_room_host(text) from public, anon;
grant execute on function public.create_room(text, jsonb, jsonb, text) to authenticated;
grant execute on function public.join_room(text, text, jsonb, text) to authenticated;
grant execute on function public.is_room_member(text) to authenticated;
grant execute on function public.is_room_host(text) to authenticated;

-- The lobby follows changes to its room and members
alter publication supabase_realtime add table public.rooms, public.room_members;

-- The room's private channel (`room:<code>`): only its members can listen, talk or be present on it
create policy "room members receive" on realtime.messages for select to authenticated
  using (realtime.topic() like 'room:%' and public.is_room_member(substring(realtime.topic() from 6)));
create policy "room members send" on realtime.messages for insert to authenticated
  with check (realtime.topic() like 'room:%' and public.is_room_member(substring(realtime.topic() from 6)));
