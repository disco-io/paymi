import { supabase } from '@/lib/supabase';
import {
  DEMO_GROUP,
  DEMO_GROUP_ID,
  DEMO_MEMBERS,
  isDevPreviewActive,
} from '@/features/dev/devPreview';
import type { Group, GroupMember } from '@/types/database';

export async function fetchMyGroups(): Promise<Group[]> {
  if (isDevPreviewActive()) return [DEMO_GROUP];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: memberships, error } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id);

  if (error) throw error;
  const ids = [...new Set((memberships ?? []).map((m) => m.group_id))];
  if (ids.length === 0) return [];

  const { data: groups, error: gErr } = await supabase
    .from('groups')
    .select('*')
    .in('id', ids)
    .order('created_at', { ascending: false });

  if (gErr) throw gErr;
  return groups ?? [];
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  if (isDevPreviewActive()) {
    if (groupId === DEMO_GROUP_ID) return DEMO_MEMBERS;
    return [];
  }

  const { data, error } = await supabase
    .from('group_members')
    .select('*, profiles(id, display_name, phone, avatar_url)')
    .eq('group_id', groupId);

  if (error) throw error;
  return (data ?? []) as GroupMember[];
}

export async function createGroup(
  name: string,
  emoji: string | null,
  creatorId: string
): Promise<Group> {
  const { data: group, error } = await supabase
    .from('groups')
    .insert({ name, emoji, created_by: creatorId })
    .select()
    .single();

  if (error) throw error;

  await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: creatorId,
    display_label: 'you',
    is_pending: false,
  });

  return group;
}

export async function addMemberByPhone(
  groupId: string,
  phoneE164: string,
  invitedBy: string
): Promise<GroupMember> {
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id, display_name, phone')
    .eq('phone', phoneE164)
    .maybeSingle();

  const displayLabel =
    existingUser?.display_name ?? phoneE164.replace('+1', '').slice(-4);

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
