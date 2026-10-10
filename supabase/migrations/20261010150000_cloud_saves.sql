-- Cloud saves (src/lib/cloudSave.ts): a copy of each player's progress, so it survives a cleared
-- browser and can be loaded on another device once an email address is linked to the account.
--
-- One row per account (anonymous or with an email). Players read and delete only their own row, and
-- write it through put_cloud_save, which keeps an older copy from overwriting a newer one and clears
-- away saves nobody has touched for two years (as the privacy policy says).

create table public.cloud_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  profile jsonb not null check (jsonb_typeof(profile) = 'object' and pg_column_size(profile) < 512000),
  -- When the profile was last changed on the device that sent it (its own updatedAt)
  saved_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index cloud_saves_updated_idx on public.cloud_saves (updated_at);

alter table public.cloud_saves enable row level security;

create policy "players read their save" on public.cloud_saves for select to authenticated
  using (user_id = (select auth.uid()));
create policy "players delete their save" on public.cloud_saves for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, delete on public.cloud_saves to authenticated;

-- Store the signed-in player's save, unless the copy already there was changed later (another device
-- got there first) - or regardless, with `p_force`, when the player chose this device's progress over
-- the cloud's. Returns the save as it now stands, so the caller can tell whether it was kept.
create function public.put_cloud_save(p_profile jsonb, p_saved_at timestamptz, p_force boolean default false) returns public.cloud_saves
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  result public.cloud_saves;
begin
  if uid is null then
    raise exception 'Sign in first';
  end if;
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then
    raise exception 'Not a save';
  end if;
  -- (a clock far in the future would lock the save against every later change)
  if p_saved_at > now() + interval '1 day' then
    p_saved_at := now();
  end if;
  delete from public.cloud_saves where updated_at < now() - interval '2 years';
  insert into public.cloud_saves (user_id, profile, saved_at, updated_at)
    values (uid, p_profile, p_saved_at, now())
    on conflict (user_id) do update
      set profile = excluded.profile, saved_at = excluded.saved_at, updated_at = now()
      where p_force or public.cloud_saves.saved_at <= excluded.saved_at;
  select * into result from public.cloud_saves where user_id = uid;
  return result;
end;
$$;

revoke execute on function public.put_cloud_save(jsonb, timestamptz, boolean) from public, anon;
grant execute on function public.put_cloud_save(jsonb, timestamptz, boolean) to authenticated;
