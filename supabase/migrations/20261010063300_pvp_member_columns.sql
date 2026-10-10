-- Room members may change only what the lobby lets them change: their name, army, colour and team.
-- (The row's room, user, seat and joining time are set by join_room and stay as they are: a member's
-- seat decides which side of the battle they play.)

revoke update on public.room_members from authenticated;
grant update (name, army, color, team) on public.room_members to authenticated;
