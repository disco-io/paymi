import type { SplitLineItem, SplitPerson } from '@/features/split/splitMath';

export type SavedSplit = {
  receiptId: string;
  groupId: string;
  merchant: string | null;
  taxCents: number;
  tipCents: number;
  items: SplitLineItem[];
  people: SplitPerson[];
  savedAt: string;
};

const savedSplits: SavedSplit[] = [];

export function saveDemoSplit(split: SavedSplit) {
  const idx = savedSplits.findIndex((s) => s.receiptId === split.receiptId);
  if (idx >= 0) {
    savedSplits[idx] = split;
  } else {
    savedSplits.unshift(split);
  }
}

export function getDemoSplitsForGroup(groupId: string): SavedSplit[] {
  return savedSplits.filter((s) => s.groupId === groupId);
}

export function getDemoSplit(receiptId: string): SavedSplit | undefined {
  return savedSplits.find((s) => s.receiptId === receiptId);
}

export function newDemoReceiptId() {
  return `demo-receipt-${Date.now()}`;
}
