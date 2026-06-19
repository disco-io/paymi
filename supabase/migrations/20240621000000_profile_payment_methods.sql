-- Multiple payment methods per profile

create table if not exists public.profile_payment_methods (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  username text not null,
  created_at timestamptz not null default now(),
  constraint profile_payment_methods_provider_check
    check (provider in ('venmo', 'paypal', 'zelle', 'other')),
  unique (profile_id, provider, username)
);

create index if not exists profile_payment_methods_profile_id_idx
  on public.profile_payment_methods(profile_id);

alter table public.profile_payment_methods enable row level security;

create policy "Users read own payment methods"
  on public.profile_payment_methods for select to authenticated
  using (profile_id = auth.uid());

create policy "Group members read peer payment methods"
  on public.profile_payment_methods for select to authenticated
  using (
    exists (
      select 1
      from public.group_members gm_self
      join public.group_members gm_peer on gm_self.group_id = gm_peer.group_id
      where gm_self.user_id = auth.uid()
        and gm_peer.user_id = profile_payment_methods.profile_id
    )
  );

create policy "Users insert own payment methods"
  on public.profile_payment_methods for insert to authenticated
  with check (profile_id = auth.uid());

create policy "Users update own payment methods"
  on public.profile_payment_methods for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "Users delete own payment methods"
  on public.profile_payment_methods for delete to authenticated
  using (profile_id = auth.uid());

-- Migrate legacy single payment fields if present
insert into public.profile_payment_methods (profile_id, provider, username)
select id, payment_provider, payment_username
from public.profiles
where payment_provider is not null
  and payment_username is not null
on conflict (profile_id, provider, username) do nothing;

alter table public.profiles
  drop column if exists payment_provider,
  drop column if exists payment_username;

create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone, display_name, username)
  values (
    new.id,
    new.phone,
    coalesce(new.raw_user_meta_data->>'display_name', null),
    lower(coalesce(new.raw_user_meta_data->>'username', null))
  )
  on conflict (id) do update set
    phone = coalesce(excluded.phone, public.profiles.phone),
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    username = coalesce(public.profiles.username, excluded.username);
  return new;
end;
$$;
