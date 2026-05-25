import { router } from 'expo-router';
import { getDemoSplit } from '@/features/dev/demoSplits';
import { isDevPreviewActive } from '@/features/dev/devPreview';
import { fetchReceiptSplit } from '@/features/receipt/api';
import type { SplitPerson } from '@/features/split/splitMath';
import { useSplitStore } from '@/features/split/splitStore';

export async function openSplitForEdit(
  receiptId: string,
  groupId: string,
  people: SplitPerson[]
) {
  const loadDraft = useSplitStore.getState().loadDraft;

  if (isDevPreviewActive()) {
    const split = getDemoSplit(receiptId);
    if (!split) return;
    loadDraft({
      groupId: split.groupId,
      receiptId: split.receiptId,
      merchant: split.merchant,
      taxCents: split.taxCents,
      tipCents: split.tipCents,
      people: split.people,
      items: split.items.map((i) => ({
        ...i,
        assignments: { ...i.assignments },
      })),
    });
  } else {
    const loaded = await fetchReceiptSplit(receiptId);
    loadDraft({
      groupId: loaded.groupId,
      receiptId: loaded.receiptId,
      merchant: loaded.merchant,
      taxCents: loaded.taxCents,
      tipCents: loaded.tipCents,
      people,
      items: loaded.items.map((i) => ({
        ...i,
        assignments: { ...i.assignments },
      })),
    });
  }

  router.push({
    pathname: '/(app)/split/assign',
    params: { groupId, editing: '1' },
  });
}
