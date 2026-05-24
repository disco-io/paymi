-- Paymi initial schema

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

-- Auto-create profile on signup
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

-- Link pending group members when user signs up
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

-- RLS
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

-- Storage bucket (run in dashboard or via SQL)
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "Receipt images for group members"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts');

create policy "Users upload receipt images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] is not null);
