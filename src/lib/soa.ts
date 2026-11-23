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

/** Inclusive event span; missing end date means a single-day event. */
export function eventSpansDay(start: string | null | undefined, end: string | null | undefined, day: string): boolean {
  if (!start) return false;
  const last = end && end >= start ? end : start;
  return start <= day && day <= last;
}

export function eventTouchesMonth(start: string | null | undefined, end: string | null | undefined, year: number, month: number): boolean {
  if (!start) return false;
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`;
  const last = end && end >= start ? end : start;
  return start <= monthEnd && last >= monthStart;
}

export function formatEventRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return "—";
  const startLabel = new Date(`${start}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  if (!end || end <= start) return startLabel;
  const endLabel = new Date(`${end}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
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
