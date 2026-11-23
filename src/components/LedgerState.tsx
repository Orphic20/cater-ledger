import { errorMessage } from "@/lib/tracker";

export function LedgerState({ isLoading, error }: { isLoading: boolean; error: unknown }) {
  if (error) return <div className="alert-box" role="alert">Couldn’t load your ledger. {errorMessage(error)}</div>;
  if (isLoading) return <div className="empty-state" role="status"><h3>Loading your ledger…</h3></div>;
  return null;
}
