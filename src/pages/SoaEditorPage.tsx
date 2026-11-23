import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CalendarDays, Check, ChevronDown, CircleAlert, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { LedgerState } from "@/components/LedgerState";
import { StatusBadge } from "@/components/StatusBadge";
import { currentManilaYear, peso, suggestNextReference } from "@/lib/soa";
import { errorMessage, isDuplicateReference, useClients, useDeleteSoa, useSaveSoa, useSetPaid, useSoas, type Client, type ViewSoa } from "@/lib/tracker";

const dateLabel = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const toText = (value: string | null) => value ?? "";

export default function SoaEditorPage({ recordId }: { recordId: string | null }) {
  const clientsQuery = useClients();
  const soasQuery = useSoas();
  if (!clientsQuery.data || !soasQuery.data) {
    return <AppShell><div className="page-wrap"><LedgerState isLoading={clientsQuery.isLoading || soasQuery.isLoading} error={clientsQuery.error ?? soasQuery.error} /></div></AppShell>;
  }
  const existing = recordId ? soasQuery.data.find(record => record.id === recordId) : undefined;
  if (recordId && !existing) {
    return <AppShell><div className="page-wrap"><div className="empty-state"><h2>SOA not found</h2><p>This statement isn’t in your ledger.</p><Button onClick={() => { window.location.href = "/soa"; }}>Back to SOA Tracker</Button></div></div></AppShell>;
  }
  return <SoaForm key={existing?.id ?? "new"} existing={existing} clients={clientsQuery.data} soas={soasQuery.data} />;
}

function SoaForm({ existing, clients, soas }: { existing?: ViewSoa; clients: Client[]; soas: ViewSoa[] }) {
  const saveSoa = useSaveSoa();
  const deleteSoa = useDeleteSoa();
  const setPaid = useSetPaid();
  const [, setPath] = useLocation();
  const [clientChoice, setClientChoice] = useState(() => existing?.clientId ?? "unassigned");
  const [newClientName, setNewClientName] = useState("");
  const [newClientContact, setNewClientContact] = useState("");
  const [date, setDate] = useState(() => toText(existing?.date ?? null));
  const [reference, setReference] = useState(() => toText(existing?.refNumber ?? null));
  const [referenceTouched, setReferenceTouched] = useState(Boolean(existing));
  const [dueDate, setDueDate] = useState(() => toText(existing?.dueDate ?? null));
  const [amount, setAmount] = useState(() => existing?.amount == null ? "" : Number(existing.amount).toFixed(2));
  const [eventName, setEventName] = useState(() => toText(existing?.eventName ?? null));
  const [eventDate, setEventDate] = useState(() => toText(existing?.eventDate ?? null));
  const [venue, setVenue] = useState(() => toText(existing?.venue ?? null));
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [amountError, setAmountError] = useState("");
  const yearParam = new URLSearchParams(window.location.search).get("year") || String(currentManilaYear());
  const returnToList = () => setPath(`/soa?year=${encodeURIComponent(yearParam)}`);
  const refTrim = reference.trim();
  const duplicateRef = Boolean(refTrim && referenceTouched && soas.some(item => item.refNumber?.toLowerCase() === refTrim.toLowerCase() && item.id !== existing?.id));
  const clientName = clients.find(client => client.id === existing?.clientId)?.name?.trim() || (existing?.clientId ? "Unnamed agency" : "Unassigned");
  const displayRef = existing?.refNumber || "No reference";
  const dateYear = date ? Number(date.slice(0, 4)) : currentManilaYear();
  const suggestion = useMemo(
    () => suggestNextReference(soas.map(item => item.refNumber), dateYear),
    [soas, dateYear],
  );

  useEffect(() => {
    if (existing || referenceTouched) return;
    setReference(suggestion);
  }, [existing, referenceTouched, suggestion]);

  function updateDate(value: string) {
    setDate(value);
  }
  function updateReference(value: string) {
    setReference(value);
    setReferenceTouched(true);
  }
  function updateAmount(value: string) {
    setAmount(value);
    if (!value || /^\d+(\.\d{0,2})?$/.test(value)) {
      setAmountError("");
      return;
    }
    setAmountError("Enter a nonnegative amount with up to two decimal places.");
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (duplicateRef) return;
    if (amount && (!/^\d+(\.\d{1,2})?$/.test(amount) || !Number.isFinite(Number(amount)) || Number(amount) < 0)) {
      setAmountError("Enter a nonnegative amount with up to two decimal places.");
      return;
    }
    let amountValue: number | null = null;
    if (amount.trim()) {
      const value = Number(amount);
      if (!Number.isFinite(value) || value < 0 || value >= 10_000_000_000) {
        setAmountError("Enter a valid amount.");
        return;
      }
      amountValue = Math.round((value + Number.EPSILON) * 100) / 100;
    }

    let newClient: { name: string; contactNumber: string } | undefined;
    let chosenClient: string | null = clientChoice === "unassigned" || clientChoice === "new" ? null : clientChoice;
    if (clientChoice === "new") newClient = { name: newClientName, contactNumber: newClientContact };
    const selectedAgencyName = clientChoice === "new"
      ? (newClientName.trim() || null)
      : clients.find(client => client.id === chosenClient)?.name?.trim() || null;

    const refMode = !referenceTouched ? "automatic" : refTrim ? "manual" : "blank";

    try {
      await saveSoa.mutateAsync({
        id: existing?.id,
        clientId: chosenClient,
        newClient,
        refMode,
        refNumber: existing || refMode === "manual" ? (refTrim || null) : null,
        agency: selectedAgencyName,
        date: date || null,
        dueDate: dueDate || null,
        amount: amountValue,
        eventName: eventName.trim() || null,
        eventDate: eventDate || null,
        venue: venue.trim() || null,
      });
      toast.success(existing ? "SOA updated" : "SOA added");
      returnToList();
    } catch (error) {
      toast.error(isDuplicateReference(error) ? "This Ref # is already in use" : errorMessage(error));
    }
  }

  async function confirmPaid() {
    if (!existing) return;
    try {
      await setPaid.mutateAsync({ id: existing.id, paid: true });
      setShowPaymentConfirm(false);
      toast.success("Payment recorded", { action: { label: "Undo", onClick: () => { void undoPaid(); } } });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function undoPaid() {
    if (!existing) return;
    try {
      await setPaid.mutateAsync({ id: existing.id, paid: false });
      toast.message("Paid status undone");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function confirmDelete() {
    if (!existing) return;
    try {
      await deleteSoa.mutateAsync(existing.id);
      toast.success("SOA deleted");
      returnToList();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return <AppShell><div className="page-wrap editor-page">
    <button type="button" className="back-link back-button" onClick={returnToList}><ArrowLeft size={16} />Back to SOA Tracker</button>
    <div className="page-heading editor-heading"><div><div className="eyebrow">{existing ? "SOA RECORD" : "NEW STATEMENT"}</div><h1>{existing ? displayRef : "Add a Statement of Account"}</h1><p>{existing ? `${clientName} · ${dateLabel(existing.date)}` : "Enter the details you have. You can fill in or change fields later."}</p></div>{existing && <StatusBadge status={existing.status} />}</div>
    <form className="editor-card" onSubmit={onSave}>
      <section className="form-section"><div className="form-section-title"><span className="form-step">1</span><div><h2>Account details</h2><p>Reference, agency, and billing information.</p></div></div>
        <div className="form-grid"><label className="form-field"><span>Ref # <i>Optional</i></span><input value={reference} onChange={event => updateReference(event.target.value)} placeholder={`e.g. 008-${dateYear}`} aria-invalid={duplicateRef} /><small className={duplicateRef ? "field-error" : "field-help"}>{duplicateRef ? "This Ref # is already in use" : `Suggested for ${dateYear}; you can edit or clear it.`}</small></label>
          <label className="form-field"><span>Agency <i>Optional</i></span><div className="select-wrap"><select value={clientChoice} onChange={event => setClientChoice(event.target.value)}><option value="unassigned">Unassigned</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name?.trim() || "Unnamed agency"}</option>)}<option value="new">+ Create an agency</option></select><ChevronDown size={15} /></div></label>
        </div>
        {clientChoice === "new" && <div className="form-grid inline-client-fields"><label className="form-field"><span>Agency name <i>Optional</i></span><input value={newClientName} onChange={event => setNewClientName(event.target.value)} placeholder="Agency name" /></label><label className="form-field"><span>Contact number <i>Optional</i></span><input value={newClientContact} onChange={event => setNewClientContact(event.target.value)} placeholder="Keep the +63 prefix or leading zero" /></label></div>}
        <div className="form-grid"><label className="form-field"><span>Amount (₱) <i>Optional</i></span><input type="number" min="0" step="0.01" value={amount} onChange={event => updateAmount(event.target.value)} placeholder="0.00" aria-invalid={Boolean(amountError)} />{amountError && <small className="field-error">{amountError}</small>}</label><label className="form-field"><span>SOA date <i>Optional</i></span><input type="date" value={date} onChange={event => updateDate(event.target.value)} /><small className="field-help">Used for yearly billing and deal counts.</small></label></div>
        <div className="form-grid"><label className="form-field"><span>Due date <i>Optional</i></span><input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /><small className="field-help">A blank due date stays Unpaid.</small></label></div>
      </section>
      <section className="form-section catering-section"><div className="form-section-title"><span className="form-step event-step"><CalendarDays size={17} /></span><div><h2>Catering event</h2><p>Optional event details appear on the calendar.</p></div></div><div className="form-grid"><label className="form-field"><span>Event name <i>Optional</i></span><input value={eventName} onChange={event => setEventName(event.target.value)} placeholder="Catering event" /></label><label className="form-field"><span>Event date <i>Optional</i></span><input type="date" value={eventDate} onChange={event => setEventDate(event.target.value)} /></label></div><label className="form-field"><span>Venue <i>Optional</i></span><input value={venue} onChange={event => setVenue(event.target.value)} placeholder="Venue or location" /></label></section>
      {existing && <section className="payment-record"><div className="payment-record-copy"><div className="eyebrow">PAYMENT STATUS</div><div className="payment-record-title">{existing.status === "Paid" ? "Payment has been recorded." : "This SOA is still outstanding."}</div><p>{existing.status === "Paid" ? "Undo the paid status if it was entered by mistake." : "Mark as Paid when the full amount has been received."}</p></div>{existing.status === "Paid" ? <Button type="button" variant="outline" onClick={() => { void undoPaid(); }}>Undo paid status</Button> : <Button type="button" className="paid-action" onClick={() => setShowPaymentConfirm(true)}><Check size={16} />Mark as Paid</Button>}</section>}
      {showPaymentConfirm && existing && <div className="confirm-payment"><CircleAlert size={20} /><div className="confirm-copy"><strong>Confirm full payment?</strong><p>{clientName}{existing.refNumber ? ` · ${existing.refNumber}` : ""} · {existing.amount == null ? "No amount entered" : peso(existing.amount)}</p></div><Button type="button" variant="outline" onClick={() => setShowPaymentConfirm(false)}>Cancel</Button><Button type="button" onClick={() => { void confirmPaid(); }}>Confirm payment</Button></div>}
      {showDeleteConfirm && existing && <div className="confirm-payment confirm-delete"><CircleAlert size={20} /><div className="confirm-copy"><strong>Delete this SOA?</strong><p>This permanently removes {existing.refNumber || "this statement"}{existing.amount == null ? "" : ` · ${peso(existing.amount)}`}.</p></div><Button type="button" variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button><Button type="button" className="delete-action" disabled={deleteSoa.isPending} onClick={() => { void confirmDelete(); }}>Delete SOA</Button></div>}
      <div className="form-footer">
        <div className="form-footer-note">{existing ? "Changes are saved to your Supabase ledger." : "All fields are optional; save what you have."}</div>
        <div className="footer-actions">
          {existing && <Button type="button" variant="outline" className="delete-outline" disabled={deleteSoa.isPending} onClick={() => setShowDeleteConfirm(true)}><Trash2 size={15} />Delete</Button>}
          <Button type="button" variant="outline" onClick={returnToList}>Cancel</Button>
          <Button type="submit" className="save-button" disabled={duplicateRef || Boolean(amountError) || saveSoa.isPending}><Save size={16} />Save SOA</Button>
        </div>
      </div>
    </form>
  </div></AppShell>;
}
