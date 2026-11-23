export type SoaStatus = "Paid" | "Unpaid" | "Overdue";

const manilaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

export function manilaToday(): string {
  const parts = manilaDate.formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function currentManilaYear(): number {
  return Number(manilaToday().slice(0, 4));
}

/** Current Manila year plus years that appear on dated SOAs. No empty past padding. */
export function ledgerYears(dates: Array<string | null | undefined>): number[] {
  const fromData = dates.flatMap(date => (date ? [Number(date.slice(0, 4))] : []));
  return [...new Set([currentManilaYear(), ...fromData])].sort((a, b) => b - a);
}

/** Format a peso amount (not centavos). */
export function peso(amount: number): string {
  return pesoFormatter.format(amount);
}

export function statusFor(paidAt: string | null, dueDate: string | null): SoaStatus {
  if (paidAt) return "Paid";
  if (dueDate && dueDate < manilaToday()) return "Overdue";
  return "Unpaid";
}

/** Prefill only. The real automatic number is assigned in create_soa. */
export function suggestNextReference(refs: Array<string | null | undefined>, year: number): string {
  const pattern = new RegExp(`^(\\d+)-${year}$`);
  let highest = 0;
  for (const ref of refs) {
    const match = ref?.match(pattern);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  const next = highest + 1;
  return `${String(next).padStart(Math.max(3, String(next).length), "0")}-${year}`;
}
