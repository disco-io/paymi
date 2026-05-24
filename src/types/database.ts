export type Profile = {
  id: string;
  phone: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  emoji: string | null;
  created_by: string;
  created_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string | null;
  phone: string | null;
  display_label: string;
  is_pending: boolean;
  created_at: string;
  profiles?: Profile | null;
};

export type ReceiptStatus = 'open' | 'settled';

export type Receipt = {
  id: string;
  group_id: string;
  created_by: string;
  image_path: string | null;
  merchant: string | null;
  receipt_date: string | null;
  tax_cents: number;
  tip_cents: number;
  status: ReceiptStatus;
  created_at: string;
};

export type ReceiptItem = {
  id: string;
  receipt_id: string;
  name: string;
  amount_cents: number;
  quantity: number;
  sort_order: number;
};

export type SplitAssignment = {
  id: string;
  receipt_item_id: string;
  member_id: string;
  share: number;
};

export type ParsedReceipt = {
  merchant: string | null;
  receipt_date: string | null;
  items: { name: string; amount_cents: number; quantity: number }[];
  tax_cents: number;
  tip_cents: number;
};
