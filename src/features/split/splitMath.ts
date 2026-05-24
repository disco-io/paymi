export type SplitPerson = {
  id: string;
  label: string;
};

export type SplitLineItem = {
  id: string;
  name: string;
  amountCents: number;
  /** member ids → share weight (e.g. 1 each, or 0.5+0.5) */
  assignments: Record<string, number>;
};

export type PersonTotal = {
  memberId: string;
  label: string;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
};

function sumAssignments(weights: Record<string, number>): number {
  return Object.values(weights).reduce((a, b) => a + b, 0);
}

/** Distribute line amount across assignees by weight. */
function allocateLine(
  amountCents: number,
  assignments: Record<string, number>
): Record<string, number> {
  const totalWeight = sumAssignments(assignments);
  if (totalWeight <= 0) return {};

  const result: Record<string, number> = {};
  let allocated = 0;
  const entries = Object.entries(assignments);
  entries.forEach(([memberId, weight], index) => {
    if (index === entries.length - 1) {
      result[memberId] = amountCents - allocated;
    } else {
      const share = Math.round((amountCents * weight) / totalWeight);
      result[memberId] = share;
      allocated += share;
    }
  });
  return result;
}

export function computePersonTotals(
  people: SplitPerson[],
  items: SplitLineItem[],
  taxCents: number,
  tipCents: number
): PersonTotal[] {
  const subtotals: Record<string, number> = {};
  people.forEach((p) => {
    subtotals[p.id] = 0;
  });

  for (const item of items) {
    const shares = allocateLine(item.amountCents, item.assignments);
    for (const [memberId, cents] of Object.entries(shares)) {
      subtotals[memberId] = (subtotals[memberId] ?? 0) + cents;
    }
  }

  const foodTotal = Object.values(subtotals).reduce((a, b) => a + b, 0);

  return people.map((person) => {
    const sub = subtotals[person.id] ?? 0;
    const ratio = foodTotal > 0 ? sub / foodTotal : 0;
    const tax = Math.round(taxCents * ratio);
    const tip = Math.round(tipCents * ratio);
    return {
      memberId: person.id,
      label: person.label,
      subtotalCents: sub,
      taxCents: tax,
      tipCents: tip,
      totalCents: sub + tax + tip,
    };
  });
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Assign everyone equally on an item. */
export function assignEveryone(
  memberIds: string[]
): Record<string, number> {
  const w: Record<string, number> = {};
  memberIds.forEach((id) => {
    w[id] = 1;
  });
  return w;
}

export function toggleAssignee(
  current: Record<string, number>,
  memberId: string
): Record<string, number> {
  const next = { ...current };
  if (next[memberId]) {
    delete next[memberId];
  } else {
    next[memberId] = 1;
  }
  return next;
}
