import type { Group, GroupMember } from '@/types/database';

export const DEMO_GROUP_ID = 'demo-aruba';
export const DEMO_GROUP: Group = {
  id: DEMO_GROUP_ID,
  name: 'Aruba spring break',
  emoji: '🏝️',
  created_by: 'demo-user',
  created_at: new Date().toISOString(),
};

export const DEMO_MEMBERS: GroupMember[] = [
  {
    id: 'demo-m1',
    group_id: DEMO_GROUP_ID,
    user_id: null,
    phone: null,
    display_label: 'you',
    is_pending: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-m2',
    group_id: DEMO_GROUP_ID,
    user_id: null,
    phone: null,
    display_label: 'delphia',
    is_pending: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-m3',
    group_id: DEMO_GROUP_ID,
    user_id: null,
    phone: null,
    display_label: 'helen',
    is_pending: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-m4',
    group_id: DEMO_GROUP_ID,
    user_id: null,
    phone: null,
    display_label: 'cia',
    is_pending: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-m5',
    group_id: DEMO_GROUP_ID,
    user_id: null,
    phone: null,
    display_label: 'gemma',
    is_pending: false,
    created_at: new Date().toISOString(),
  },
];

export function isDemoGroup(groupId: string | null | undefined) {
  return groupId === DEMO_GROUP_ID;
}
