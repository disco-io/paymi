import { supabase } from '@/lib/supabase';
import type { ParsedReceipt, Receipt, ReceiptItem } from '@/types/database';

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
