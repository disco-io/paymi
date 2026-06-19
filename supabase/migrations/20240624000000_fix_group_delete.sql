-- Fix group delete: leader membership blocked cascade; add reliable delete RPC

drop policy if exists "Leaders remove group members" on public.group_members;

create policy "Leaders remove any group member"
  on public.group_members for delete to authenticated
  using (public.is_group_leader(group_id));

drop policy if exists "Creators delete groups" on public.groups;
create policy "Creators delete groups"
  on public.groups for delete to authenticated
  using (created_by = auth.uid());

create or replace function public.delete_group(gid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.groups
    where id = gid and created_by = auth.uid()
  ) then
    raise exception 'only the group leader can delete this group';
  end if;

  delete from public.groups where id = gid;
end;
$$;

revoke all on function public.delete_group(uuid) from public;
grant execute on function public.delete_group(uuid) to authenticated;
