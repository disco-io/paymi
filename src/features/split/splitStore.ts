import { create } from 'zustand';
import type { ParsedReceipt } from '@/types/database';
import type { SplitLineItem, SplitPerson } from './splitMath';

type SplitDraft = {
  groupId: string;
  receiptId: string | null;
  imageUri: string | null;
  imagePath: string | null;
  merchant: string | null;
  receiptDate: string | null;
  taxCents: number;
  tipCents: number;
  people: SplitPerson[];
  items: SplitLineItem[];
};

const initial: SplitDraft = {
  groupId: '',
  receiptId: null,
  imageUri: null,
  imagePath: null,
  merchant: null,
  receiptDate: null,
  taxCents: 0,
  tipCents: 0,
  people: [],
  items: [],
};

type SplitStore = SplitDraft & {
  reset: () => void;
  initGroup: (groupId: string, people: SplitPerson[]) => void;
  setImage: (uri: string, path: string) => void;
  applyParsed: (parsed: ParsedReceipt) => void;
  setTaxTip: (taxCents: number, tipCents: number) => void;
  setMerchant: (merchant: string) => void;
  updateItem: (id: string, patch: Partial<SplitLineItem>) => void;
  addItem: (name: string, amountCents: number) => string;
  removeItem: (id: string) => void;
  setItemAssignments: (itemId: string, assignments: Record<string, number>) => void;
  setReceiptId: (id: string) => void;
};

let itemCounter = 0;
export function newItemId() {
  itemCounter += 1;
  return `item_${Date.now()}_${itemCounter}`;
}

export const useSplitStore = create<SplitStore>((set) => ({
  ...initial,
  reset: () => set({ ...initial }),
  initGroup: (groupId, people) =>
    set({
      ...initial,
      groupId,
      people,
    }),
  setImage: (uri, path) => set({ imageUri: uri, imagePath: path }),
  applyParsed: (parsed) =>
    set({
      merchant: parsed.merchant,
      receiptDate: parsed.receipt_date,
      taxCents: parsed.tax_cents,
      tipCents: parsed.tip_cents,
      items: parsed.items.map((item, i) => ({
        id: newItemId(),
        name: item.name,
        amountCents: item.amount_cents,
        assignments: {},
      })),
    }),
  setTaxTip: (taxCents, tipCents) => set({ taxCents, tipCents }),
  setMerchant: (merchant) => set({ merchant }),
  updateItem: (id, patch) =>
    set((s) => ({
      items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    })),
  addItem: (name, amountCents) => {
    const id = newItemId();
    set((s) => ({
      items: [
        ...s.items,
        { id, name, amountCents, assignments: {} },
      ],
    }));
    return id;
  },
  removeItem: (id) =>
    set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
  setItemAssignments: (itemId, assignments) =>
    set((s) => ({
      items: s.items.map((it) =>
        it.id === itemId ? { ...it, assignments } : it
      ),
    })),
  setReceiptId: (id) => set({ receiptId: id }),
}));
