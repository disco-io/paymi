import { supabase } from '@/lib/supabase';
import type { ParsedReceipt, Receipt, ReceiptItem } from '@/types/database';
import type { SplitLineItem } from '@/features/split/splitMath';

export type ReceiptListItem = {
  id: string;
  merchant: string | null;
  tax_cents: number;
  tip_cents: number;
  created_at: string;
};

export type LoadedReceiptSplit = {
  receiptId: string;
  groupId: string;
  merchant: string | null;
  taxCents: number;
  tipCents: number;
  items: SplitLineItem[];
};

export async function uploadReceiptImage(
  groupId: string,
  userId: string,
  localUri: string
): Promise<string> {
  const ext = localUri.endsWith('.png') ? 'png' : 'jpg';
  const path = `${groupId}/${userId}/${Date.now()}.${ext}`;

  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from('receipts')
    .upload(path, arrayBuffer, {
      contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
      upsert: false,
    });

  if (error) throw error;
  return path;
}

export async function parseReceiptImage(
  storagePath: string
): Promise<ParsedReceipt> {
  const { data, error } = await supabase.functions.invoke('parse-receipt', {
    body: { storage_path: storagePath },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as ParsedReceipt;
}

export async function createReceipt(
  groupId: string,
  userId: string,
  fields: {
    image_path: string | null;
    merchant: string | null;
    receipt_date: string | null;
    tax_cents: number;
    tip_cents: number;
  }
): Promise<Receipt> {
  const { data, error } = await supabase
    .from('receipts')
    .insert({
      group_id: groupId,
      created_by: userId,
      ...fields,
      status: 'open',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function saveReceiptItems(
  receiptId: string,
  items: { name: string; amount_cents: number; quantity: number }[]
): Promise<ReceiptItem[]> {
  const rows = items.map((item, i) => ({
    receipt_id: receiptId,
    name: item.name,
    amount_cents: item.amount_cents,
    quantity: item.quantity,
    sort_order: i,
  }));

  const { data, error } = await supabase
    .from('receipt_items')
    .insert(rows)
    .select();

  if (error) throw error;
  return data ?? [];
}

export async function saveAssignments(
  receiptItemId: string,
  assignments: { member_id: string; share: number }[]
) {
  if (assignments.length === 0) return;

  const { error } = await supabase.from('split_assignments').insert(
    assignments.map((a) => ({
      receipt_item_id: receiptItemId,
      member_id: a.member_id,
      share: a.share,
    }))
  );

  if (error) throw error;
}

export async function fetchGroupReceipts(groupId: string): Promise<ReceiptListItem[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('id, merchant, tax_cents, tip_cents, created_at')
    .eq('group_id', groupId)
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchReceiptSplit(receiptId: string): Promise<LoadedReceiptSplit> {
  const { data: receipt, error: rErr } = await supabase
    .from('receipts')
    .select('id, group_id, merchant, tax_cents, tip_cents')
    .eq('id', receiptId)
    .single();

  if (rErr || !receipt) throw rErr ?? new Error('Receipt not found');

  const { data: dbItems, error: iErr } = await supabase
    .from('receipt_items')
    .select('id, name, amount_cents, sort_order')
    .eq('receipt_id', receiptId)
    .order('sort_order');

  if (iErr) throw iErr;

  const itemIds = (dbItems ?? []).map((i) => i.id);
  let assignmentRows: { receipt_item_id: string; member_id: string; share: number }[] = [];

  if (itemIds.length > 0) {
    const { data: assignments, error: aErr } = await supabase
      .from('split_assignments')
      .select('receipt_item_id, member_id, share')
      .in('receipt_item_id', itemIds);

    if (aErr) throw aErr;
    assignmentRows = assignments ?? [];
  }

  const items: SplitLineItem[] = (dbItems ?? []).map((row) => {
    const assignments: Record<string, number> = {};
    assignmentRows
      .filter((a) => a.receipt_item_id === row.id)
      .forEach((a) => {
        assignments[a.member_id] = Number(a.share);
      });
    return {
      id: row.id,
      name: row.name,
      amountCents: row.amount_cents,
      assignments,
    };
  });

  return {
    receiptId: receipt.id,
    groupId: receipt.group_id,
    merchant: receipt.merchant,
    taxCents: receipt.tax_cents,
    tipCents: receipt.tip_cents,
    items,
  };
}

export async function updateReceipt(
  receiptId: string,
  fields: {
    merchant: string | null;
    tax_cents: number;
    tip_cents: number;
  }
) {
  const { error } = await supabase
    .from('receipts')
    .update(fields)
    .eq('id', receiptId);

  if (error) throw error;
}

export async function replaceReceiptSplit(
  receiptId: string,
  items: { name: string; amount_cents: number; quantity: number }[],
  assignmentsByIndex: { member_id: string; share: number }[][]
) {
  const { error: delErr } = await supabase
    .from('receipt_items')
    .delete()
    .eq('receipt_id', receiptId);

  if (delErr) throw delErr;

  const dbItems = await saveReceiptItems(receiptId, items);

  for (let i = 0; i < dbItems.length; i++) {
    await saveAssignments(dbItems[i].id, assignmentsByIndex[i] ?? []);
  }

  return dbItems;
}

export async function persistReceiptSplit(
  receiptId: string,
  fields: {
    merchant: string | null;
    tax_cents: number;
    tip_cents: number;
  },
  items: { name: string; amount_cents: number; quantity: number }[],
  assignmentsByIndex: { member_id: string; share: number }[][]
) {
  await updateReceipt(receiptId, fields);
  await replaceReceiptSplit(receiptId, items, assignmentsByIndex);
}
