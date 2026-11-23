import { useState, type MouseEvent } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { peso } from "@/lib/soa";
import { errorMessage, useClients, useSetPaid, type ViewSoa } from "@/lib/tracker";

export function StatusQuickAction({ record }: { record: ViewSoa }) {
  const clients = useClients();
  const setPaid = useSetPaid();
  const [confirming, setConfirming] = useState(false);
  const stop = (event: MouseEvent) => event.stopPropagation();
  const client = clients.data?.find(item => item.id === record.clientId);
  const clientName = client?.name?.trim() || (record.clientId ? "Unnamed agency" : "Unassigned");
  async function undo() {
    try {
      await setPaid.mutateAsync({ id: record.id, paid: false });
      toast.message("Paid status undone");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  async function confirmPaid() {
    try {
      await setPaid.mutateAsync({ id: record.id, paid: true });
      setConfirming(false);
      toast.success("Payment recorded", { action: { label: "Undo", onClick: () => { void undo(); } } });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  return <>
    {record.status === "Paid" ? <button type="button" className="quick-status undo-quick" onClick={event => { stop(event); undo(); }}><RotateCcw size={12} />Undo paid</button> : <button type="button" className="quick-status pay-quick" onClick={event => { stop(event); setConfirming(true); }}><Check size={12} />Mark paid</button>}
    {confirming && <div className="modal-backdrop quick-confirm-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setConfirming(false); }}><section className="quick-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby={`confirm-${record.id}`} onClick={stop}><button type="button" className="icon-button quick-close" onClick={() => setConfirming(false)} aria-label="Close"><X size={16} /></button><div className="confirm-mark"><Check size={18} /></div><h2 id={`confirm-${record.id}`}>Mark this SOA as Paid?</h2><p>Confirm the full payment received for this statement.</p><div className="confirm-details"><span>Agency</span><strong>{clientName}</strong><span>Ref #</span><strong>{record.refNumber || "—"}</strong><span>Amount</span><strong>{record.amount == null ? "No amount entered" : peso(record.amount)}</strong></div><div className="quick-confirm-actions"><Button type="button" variant="outline" onClick={() => setConfirming(false)}>Cancel</Button><Button type="button" className="paid-action" onClick={confirmPaid}><Check size={15} />Confirm Paid</Button></div></section></div>}
  </>;
}
