import { supabase } from '@/lib/supabase';
import { isMissingDbObjectError } from '@/lib/errors';
import {
  DEMO_GROUP,
  DEMO_GROUP_ID,
  DEMO_MEMBERS,
  isDemoGroup,
} from '@/features/dev/devPreview';
import type { Group, GroupMember } from '@/types/database';

async function getCreatorLabel(creatorId: string): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', creatorId)
    .maybeSingle();
  return data?.display_name?.trim() || 'you';
}

export async function fetchMyGroups(): Promise<Group[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [DEMO_GROUP];

  const { data: memberships, error } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id);

  if (error) throw error;
  const ids = [...new Set((memberships ?? []).map((m) => m.group_id))];

  let real: Group[] = [];
  if (ids.length > 0) {
    const { data: groups, error: gErr } = await supabase
      .from('groups')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: false });

    if (gErr) throw gErr;
    real = groups ?? [];
  }

  return [DEMO_GROUP, ...real.filter((g) => g.id !== DEMO_GROUP_ID)];
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  if (isDemoGroup(groupId)) return DEMO_MEMBERS;

  const { data, error } = await supabase
    .from('group_members')
    .select('*, profiles(id, display_name, phone, avatar_url)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as GroupMember[];
}

export async function createGroup(
  name: string,
  emoji: string | null,
  creatorId: string
): Promise<Group> {
  const creatorLabel = await getCreatorLabel(creatorId);

  const { data: group, error } = await supabase
    .from('groups')
    .insert({ name, emoji, created_by: creatorId })
    .select()
    .single();

  if (error) throw error;

  const { error: memberErr } = await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: creatorId,
    display_label: creatorLabel,
    is_pending: false,
  });

  if (memberErr) throw memberErr;

  return group;
}

export async function addMemberByPhone(
  groupId: string,
  phoneE164: string,
  _invitedBy: string
): Promise<GroupMember> {
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id, display_name, phone')
    .eq('phone', phoneE164)
    .maybeSingle();

  const displayLabel =
    existingUser?.display_name?.trim() ??
    phoneE164.replace('+1', '').slice(-4);

  const { data, error } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: existingUser?.id ?? null,
      phone: phoneE164,
      display_label: displayLabel,
      is_pending: !existingUser,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function isGroupLeader(group: Group, userId: string | undefined): boolean {
  return Boolean(userId && group.created_by === userId);
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error: rpcError } = await supabase.rpc('delete_group', { gid: groupId });

  if (!rpcError) return;

  if (!isMissingDbObjectError(rpcError.message)) {
    throw new Error(rpcError.message);
  }

  const { data, error } = await supabase
    .from('groups')
    .delete()
    .eq('id', groupId)
    .select('id');

  if (error) throw error;
  if (!data?.length) {
    throw new Error(
      'could not delete group — run supabase db push, and make sure you are the group leader'
    );
  }
}

export async function removeGroupMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('group_members').delete().eq('id', memberId);
  if (error) throw error;
}
