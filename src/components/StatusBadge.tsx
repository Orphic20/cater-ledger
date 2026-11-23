import type { SoaStatus } from "@/lib/soa";

export function StatusBadge({ status }: { status: SoaStatus }) {
  return (
    <span className={`status-pill ${status.toLowerCase()}`}>
      <span className="status-indicator" />
      {status}
    </span>
  );
}
