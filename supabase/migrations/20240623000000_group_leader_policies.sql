-- Group leader: delete groups, remove members; members can leave

create or replace function public.is_group_leader(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.groups
    where id = gid and created_by = auth.uid()
  );
$$;

create policy "Creators delete groups"
  on public.groups for delete to authenticated
  using (created_by = auth.uid());

create policy "Leaders remove group members"
  on public.group_members for delete to authenticated
  using (
    public.is_group_leader(group_id)
    and user_id is distinct from auth.uid()
  );

create policy "Members leave group"
  on public.group_members for delete to authenticated
  using (
    user_id = auth.uid()
    and not public.is_group_leader(group_id)
  );
