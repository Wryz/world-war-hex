-- Realtime for online battle rooms (see pvp_rooms): the lobby follows its room and members, and the
-- room's private channel carries the battle.

-- The lobby follows changes to its room and members
alter publication supabase_realtime add table public.rooms, public.room_members;

-- The room's private channel (`room:<code>`): only its members can listen, talk or be present on it
create policy "room members receive" on realtime.messages for select to authenticated
  using (realtime.topic() like 'room:%' and public.is_room_member(substring(realtime.topic() from 6)));
create policy "room members send" on realtime.messages for insert to authenticated
  with check (realtime.topic() like 'room:%' and public.is_room_member(substring(realtime.topic() from 6)));
