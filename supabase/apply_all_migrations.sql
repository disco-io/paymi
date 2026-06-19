-- Paymi: run this entire file once in Supabase SQL Editor
-- Dashboard → paymi → SQL Editor → New query → paste → Run
--
-- https://supabase.com/dashboard/project/gvfzsfjxehjnqdjokvcv/sql/new

-- ========== Migration 1: initial schema ==========

create extension if not exists "uuid-ossp";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  phone text,
  display_label text not null,
  is_pending boolean not null default false,
  created_at timestamptz not null default now(),
  unique (group_id, user_id),
  unique (group_id, phone)
);

create type public.receipt_status as enum ('open', 'settled');

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  image_path text,
  merchant text,
  receipt_date date,
  tax_cents integer not null default 0,
  tip_cents integer not null default 0,
  status public.receipt_status not null default 'open',
  created_at timestamptz not null default now()
);

create table public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  name text not null,
  amount_cents integer not null,
  quantity integer not null default 1,
  sort_order integer not null default 0
);

create table public.split_assignments (
  id uuid primary key default gen_random_uuid(),
  receipt_item_id uuid not null references public.receipt_items(id) on delete cascade,
  member_id uuid not null references public.group_members(id) on delete cascade,
  share numeric not null default 1,
  unique (receipt_item_id, member_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone, display_name)
  values (
    new.id,
    new.phone,
    coalesce(new.raw_user_meta_data->>'display_name', null)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.link_pending_members()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.phone is not null then
    update public.group_members
    set user_id = new.id, is_pending = false,
        display_label = coalesce(new.display_name, display_label)
    where phone = new.phone and user_id is null;
  end if;
  return new;
end;
$$;

create trigger on_profile_created_link_members
  after insert on public.profiles
  for each row execute procedure public.link_pending_members();

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.split_assignments enable row level security;

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create policy "Profiles viewable by authenticated"
  on public.profiles for select to authenticated using (true);

create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id);

create policy "Groups visible to members"
  on public.groups for select to authenticated
  using (public.is_group_member(id) or created_by = auth.uid());

create policy "Users create groups"
  on public.groups for insert to authenticated
  with check (created_by = auth.uid());

create policy "Group members visible to members"
  on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

create policy "Members can insert into their groups"
  on public.group_members for insert to authenticated
  with check (public.is_group_member(group_id) or exists (
    select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()
  ));

create policy "Receipts for group members"
  on public.receipts for all to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id) and created_by = auth.uid());

create policy "Receipt items via receipt"
  on public.receipt_items for all to authenticated
  using (exists (
    select 1 from public.receipts r
    where r.id = receipt_id and public.is_group_member(r.group_id)
  ));

create policy "Assignments via receipt"
  on public.split_assignments for all to authenticated
  using (exists (
    select 1 from public.receipt_items ri
    join public.receipts r on r.id = ri.receipt_id
    where ri.id = receipt_item_id and public.is_group_member(r.group_id)
  ));

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "Receipt images for group members"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts');

create policy "Users upload receipt images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] is not null);

-- ========== Migration 2: auth sync + RLS fixes ==========

create policy "Users insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone, display_name)
  values (
    new.id,
    new.phone,
    coalesce(new.raw_user_meta_data->>'display_name', null)
  )
  on conflict (id) do update set
    phone = coalesce(excluded.phone, public.profiles.phone),
    display_name = coalesce(
      public.profiles.display_name,
      excluded.display_name
    );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert or update of phone, raw_user_meta_data on auth.users
  for each row execute procedure public.sync_profile_from_auth();

create or replace function public.link_pending_members()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.phone is not null then
    update public.group_members
    set
      user_id = new.id,
      is_pending = false,
      display_label = coalesce(new.display_name, display_label)
    where phone = new.phone and user_id is null;
  end if;

  if new.display_name is not null then
    update public.group_members
    set display_label = new.display_name
    where user_id = new.id
      and display_label is distinct from new.display_name;
  end if;

  return new;
end;
$$;

drop trigger if exists on_profile_created_link_members on public.profiles;

create trigger on_profile_link_members
  after insert or update of phone, display_name on public.profiles
  for each row execute procedure public.link_pending_members();

create policy "Creators update groups"
  on public.groups for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Receipt items via receipt" on public.receipt_items;

create policy "Receipt items visible to members"
  on public.receipt_items for select to authenticated
  using (exists (
    select 1 from public.receipts r
    where r.id = receipt_id and public.is_group_member(r.group_id)
  ));

create policy "Receipt items writable by members"
  on public.receipt_items for insert to authenticated
  with check (exists (
    select 1 from public.receipts r
    where r.id = receipt_id and public.is_group_member(r.group_id)
  ));

create policy "Receipt items updatable by members"
  on public.receipt_items for update to authenticated
  using (exists (
    select 1 from public.receipts r
    where r.id = receipt_id and public.is_group_member(r.group_id)
  ))
  with check (exists (
    select 1 from public.receipts r
    where r.id = receipt_id and public.is_group_member(r.group_id)
  ));

create policy "Receipt items deletable by members"
  on public.receipt_items for delete to authenticated
  using (exists (
    select 1 from public.receipts r
    where r.id = receipt_id and public.is_group_member(r.group_id)
  ));

drop policy if exists "Assignments via receipt" on public.split_assignments;

create policy "Assignments visible to members"
  on public.split_assignments for select to authenticated
  using (exists (
    select 1 from public.receipt_items ri
    join public.receipts r on r.id = ri.receipt_id
    where ri.id = receipt_item_id and public.is_group_member(r.group_id)
  ));

create policy "Assignments writable by members"
  on public.split_assignments for insert to authenticated
  with check (exists (
    select 1 from public.receipt_items ri
    join public.receipts r on r.id = ri.receipt_id
    where ri.id = receipt_item_id and public.is_group_member(r.group_id)
  ));

create policy "Assignments updatable by members"
  on public.split_assignments for update to authenticated
  using (exists (
    select 1 from public.receipt_items ri
    join public.receipts r on r.id = ri.receipt_id
    where ri.id = receipt_item_id and public.is_group_member(r.group_id)
  ))
  with check (exists (
    select 1 from public.receipt_items ri
    join public.receipts r on r.id = ri.receipt_id
    where ri.id = receipt_item_id and public.is_group_member(r.group_id)
  ));

create policy "Assignments deletable by members"
  on public.split_assignments for delete to authenticated
  using (exists (
    select 1 from public.receipt_items ri
    join public.receipts r on r.id = ri.receipt_id
    where ri.id = receipt_item_id and public.is_group_member(r.group_id)
  ));

create index if not exists group_members_user_id_idx on public.group_members(user_id);
create index if not exists group_members_group_id_idx on public.group_members(group_id);
create index if not exists group_members_phone_idx on public.group_members(phone);
create index if not exists receipts_group_id_idx on public.receipts(group_id);
create index if not exists receipt_items_receipt_id_idx on public.receipt_items(receipt_id);

-- 20240620000000_profile_username_payment.sql
alter table public.profiles
  add column if not exists username text,
  add column if not exists payment_provider text,
  add column if not exists payment_username text;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

do $$ begin
  alter table public.profiles
    add constraint profiles_payment_provider_check
    check (
      payment_provider is null
      or payment_provider in ('venmo', 'paypal', 'zelle', 'other')
    );
exception when duplicate_object then null;
end $$;

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
