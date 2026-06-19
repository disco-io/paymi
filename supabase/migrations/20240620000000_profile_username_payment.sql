-- Profile username + payment handles, signup availability check

alter table public.profiles
  add column if not exists username text,
  add column if not exists payment_provider text,
  add column if not exists payment_username text;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

alter table public.profiles
  add constraint profiles_payment_provider_check
  check (
    payment_provider is null
    or payment_provider in ('venmo', 'paypal', 'zelle', 'other')
  );

-- Anon can check availability before sign-up (no profile row exists yet)
create or replace function public.check_signup_available(p_phone text, p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text := lower(trim(p_username));
begin
  if p_phone is not null and exists (
    select 1 from public.profiles where phone = p_phone
  ) then
    return 'phone_taken';
  end if;

  if normalized_username <> '' and exists (
    select 1 from public.profiles where lower(username) = normalized_username
  ) then
    return 'username_taken';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.check_signup_available(text, text) from public;
grant execute on function public.check_signup_available(text, text) to anon, authenticated;

-- Keep auth trigger in sync with new profile fields
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone, display_name, username, payment_provider, payment_username)
  values (
    new.id,
    new.phone,
    coalesce(new.raw_user_meta_data->>'display_name', null),
    lower(coalesce(new.raw_user_meta_data->>'username', null)),
    coalesce(new.raw_user_meta_data->>'payment_provider', null),
    coalesce(new.raw_user_meta_data->>'payment_username', null)
  )
  on conflict (id) do update set
    phone = coalesce(excluded.phone, public.profiles.phone),
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    username = coalesce(public.profiles.username, excluded.username),
    payment_provider = coalesce(public.profiles.payment_provider, excluded.payment_provider),
    payment_username = coalesce(public.profiles.payment_username, excluded.payment_username);
  return new;
end;
$$;
