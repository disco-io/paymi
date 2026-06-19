-- Auth sync, profile policies, and RLS fixes for shared group data

-- ---------------------------------------------------------------------------
-- Profiles: users can create and update their own row (onboarding + phone)
-- ---------------------------------------------------------------------------

create policy "Users insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- Replace insert-only trigger with upsert that keeps phone in sync
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

-- Link pending group invites when phone or name is set on profile
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

  -- Refresh labels for rows already linked to this user
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

-- ---------------------------------------------------------------------------
-- Groups: creators can rename
-- ---------------------------------------------------------------------------

create policy "Creators update groups"
  on public.groups for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Receipt items + assignments: explicit write policies
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Indexes for group + receipt queries
-- ---------------------------------------------------------------------------

create index if not exists group_members_user_id_idx on public.group_members(user_id);
create index if not exists group_members_group_id_idx on public.group_members(group_id);
create index if not exists group_members_phone_idx on public.group_members(phone);
create index if not exists receipts_group_id_idx on public.receipts(group_id);
create index if not exists receipt_items_receipt_id_idx on public.receipt_items(receipt_id);
