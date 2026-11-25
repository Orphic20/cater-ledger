import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CalendarDays, Check, ChevronDown, CircleAlert, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { LedgerState } from "@/components/LedgerState";
import { StatusBadge } from "@/components/StatusBadge";
import { currentManilaYear, peso, suggestNextReference } from "@/lib/soa";
import {
  errorMessage,
  isDuplicateReference,
  useCateringEvents,
  useClients,
  useDeleteSoa,
  useSaveSoa,
  useSetPaid,
  useSoas,
  type Client,
  type ViewSoa,
} from "@/lib/tracker";

const dateLabel = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const toText = (value: string | null) => value ?? "";

export default function SoaEditorPage({ recordId }: { recordId: string | null }) {
  const clientsQuery = useClients();
  const soasQuery = useSoas();
  const eventsQuery = useCateringEvents();
  if (!clientsQuery.data || !soasQuery.data || !eventsQuery.data) {
    return (
      <AppShell>
        <div className="page-wrap">
          <LedgerState
            isLoading={clientsQuery.isLoading || soasQuery.isLoading || eventsQuery.isLoading}
            error={clientsQuery.error ?? soasQuery.error ?? eventsQuery.error}
          />
        </div>
      </AppShell>
    );
  }
  const existing = recordId ? soasQuery.data.find(record => record.id === recordId) : undefined;
  if (recordId && !existing) {
    return (
      <AppShell>
        <div className="page-wrap">
          <div className="empty-state">
            <h2>SOA not found</h2>
            <p>This statement isn’t in your ledger.</p>
            <Button onClick={() => { window.location.href = "/soa"; }}>Back to SOA Tracker</Button>
          </div>
        </div>
      </AppShell>
    );
  }
  return (
    <SoaForm
      key={existing?.id ?? "new"}
      existing={existing}
      clients={clientsQuery.data}
      soas={soasQuery.data}
      events={eventsQuery.data}
    />
  );
}

function SoaForm({
  existing,
  clients,
  soas,
  events,
}: {
  existing?: ViewSoa;
  clients: Client[];
  soas: ViewSoa[];
  events: { id: string; clientId: string | null; name: string | null; days: { eventDate: string }[] }[];
}) {
  const saveSoa = useSaveSoa();
  const deleteSoa = useDeleteSoa();
  const setPaid = useSetPaid();
  const [, setPath] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const [clientChoice, setClientChoice] = useState(
    () => existing?.clientId ?? params.get("clientId") ?? "unassigned",
  );
  const [newClientName, setNewClientName] = useState("");
  const [newClientContactName, setNewClientContactName] = useState("");
  const [newClientContact, setNewClientContact] = useState("");
  const [date, setDate] = useState(() => toText(existing?.date ?? null));
  const [reference, setReference] = useState(() => toText(existing?.refNumber ?? null));
  const [referenceTouched, setReferenceTouched] = useState(Boolean(existing));
  const [dueDate, setDueDate] = useState(() => toText(existing?.dueDate ?? null));
  const [amount, setAmount] = useState(() => existing?.amount == null ? "" : Number(existing.amount).toFixed(2));
  const [cateringEventId, setCateringEventId] = useState(
    () => existing?.cateringEventId ?? params.get("eventId") ?? "unlinked",
  );
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [amountError, setAmountError] = useState("");
  const yearParam = params.get("year") || String(currentManilaYear());
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

  const linkedClientId = clientChoice === "unassigned" || clientChoice === "new" ? null : clientChoice;
  const eventOptions = events.filter(event => !linkedClientId || event.clientId === linkedClientId || event.id === cateringEventId);

  useEffect(() => {
    if (existing || referenceTouched) return;
    setReference(suggestion);
  }, [existing, referenceTouched, suggestion]);

  useEffect(() => {
    if (cateringEventId === "unlinked") return;
    const selected = events.find(event => event.id === cateringEventId);
    if (!selected) {
      setCateringEventId("unlinked");
      return;
    }
    if (linkedClientId && selected.clientId && selected.clientId !== linkedClientId) {
      setCateringEventId("unlinked");
    }
  }, [linkedClientId, cateringEventId, events]);

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

    let newClient: { name: string; contactName: string; contactNumber: string } | undefined;
    let chosenClient: string | null = clientChoice === "unassigned" || clientChoice === "new" ? null : clientChoice;
    if (clientChoice === "new") {
      newClient = {
        name: newClientName,
        contactName: newClientContactName,
        contactNumber: newClientContact,
      };
    }
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
        cateringEventId: cateringEventId === "unlinked" ? null : cateringEventId,
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

  const eventLabel = (event: { name: string | null; days: { eventDate: string }[] }) => {
    const title = event.name?.trim() || "Untitled event";
    const dates = [...event.days].map(day => day.eventDate).sort();
    if (!dates.length) return title;
    if (dates.length === 1) return `${title} · ${dates[0]}`;
    return `${title} · ${dates[0]} to ${dates[dates.length - 1]}`;
  };

  return (
    <AppShell>
      <div className="page-wrap editor-page">
        <button type="button" className="back-link back-button" onClick={returnToList}>
          <ArrowLeft size={16} />Back to SOA Tracker
        </button>
        <div className="page-heading editor-heading">
          <div>
            <div className="eyebrow">{existing ? "SOA RECORD" : "NEW STATEMENT"}</div>
            <h1>{existing ? displayRef : "Add a Statement of Account"}</h1>
            <p>{existing ? `${clientName} · ${dateLabel(existing.date)}` : "Enter the billing details you have. Linking a catering event is optional."}</p>
          </div>
          {existing && <StatusBadge status={existing.status} />}
        </div>
        <form className="editor-card" onSubmit={onSave}>
          <section className="form-section">
            <div className="form-section-title">
              <span className="form-step">1</span>
              <div><h2>Account details</h2><p>Reference, agency, and billing information.</p></div>
            </div>
            <div className="form-grid">
              <label className="form-field">
                <span>Ref # <i>Optional</i></span>
                <input value={reference} onChange={event => updateReference(event.target.value)} placeholder={`e.g. 008-${dateYear}`} aria-invalid={duplicateRef} />
                <small className={duplicateRef ? "field-error" : "field-help"}>
                  {duplicateRef ? "This Ref # is already in use" : `Suggested for ${dateYear}; you can edit or clear it.`}
                </small>
              </label>
              <label className="form-field">
                <span>Agency <i>Optional</i></span>
                <div className="select-wrap">
                  <select value={clientChoice} onChange={event => setClientChoice(event.target.value)}>
                    <option value="unassigned">Unassigned</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name?.trim() || "Unnamed agency"}</option>
                    ))}
                    <option value="new">+ Create an agency</option>
                  </select>
                  <ChevronDown size={15} />
                </div>
              </label>
            </div>
            {clientChoice === "new" && (
              <div className="form-grid inline-client-fields">
                <label className="form-field"><span>Agency name <i>Optional</i></span><input value={newClientName} onChange={event => setNewClientName(event.target.value)} placeholder="Agency name" /></label>
                <label className="form-field"><span>Contact name <i>Optional</i></span><input value={newClientContactName} onChange={event => setNewClientContactName(event.target.value)} placeholder="Contact person" /></label>
                <label className="form-field"><span>Contact number <i>Optional</i></span><input value={newClientContact} onChange={event => setNewClientContact(event.target.value)} placeholder="Keep the +63 prefix or leading zero" /></label>
              </div>
            )}
            <div className="form-grid">
              <label className="form-field">
                <span>Amount (₱) <i>Optional</i></span>
                <input type="number" min="0" step="0.01" value={amount} onChange={event => updateAmount(event.target.value)} placeholder="0.00" aria-invalid={Boolean(amountError)} />
                {amountError && <small className="field-error">{amountError}</small>}
              </label>
              <label className="form-field">
                <span>SOA date <i>Optional</i></span>
                <input type="date" value={date} onChange={event => updateDate(event.target.value)} />
                <small className="field-help">Used for yearly billing and transaction counts.</small>
              </label>
            </div>
            <div className="form-grid">
              <label className="form-field">
                <span>Due date <i>Optional</i></span>
                <input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} />
                <small className="field-help">A blank due date stays Unpaid.</small>
              </label>
            </div>
          </section>

          <section className="form-section catering-section">
            <div className="form-section-title">
              <span className="form-step event-step"><CalendarDays size={17} /></span>
              <div>
                <h2>Catering event</h2>
                <p>Optional link to a booking. One SOA can cover a whole multi-day menu.</p>
              </div>
            </div>
            <label className="form-field">
              <span>Linked catering event <i>Optional</i></span>
              <div className="select-wrap">
                <select value={cateringEventId} onChange={event => setCateringEventId(event.target.value)}>
                  <option value="unlinked">Not linked</option>
                  {eventOptions.map(event => (
                    <option key={event.id} value={event.id}>{eventLabel(event)}</option>
                  ))}
                </select>
                <ChevronDown size={15} />
              </div>
              <small className="field-help">
                {linkedClientId
                  ? "Showing events for the selected agency."
                  : "Select an agency to filter events, or leave unlinked."}
              </small>
            </label>
          </section>

          {existing && (
            <section className="payment-record">
              <div className="payment-record-copy">
                <div className="eyebrow">PAYMENT STATUS</div>
                <div className="payment-record-title">
                  {existing.status === "Paid" ? "Payment has been recorded." : "This SOA is still outstanding."}
                </div>
                <p>
                  {existing.status === "Paid"
                    ? "Undo the paid status if it was entered by mistake."
                    : "Mark as Paid when the full amount has been received."}
                </p>
              </div>
              {existing.status === "Paid"
                ? <Button type="button" variant="outline" onClick={() => { void undoPaid(); }}>Undo paid status</Button>
                : <Button type="button" className="paid-action" onClick={() => setShowPaymentConfirm(true)}><Check size={16} />Mark as Paid</Button>}
            </section>
          )}

          {showPaymentConfirm && existing && (
            <div className="confirm-payment">
              <CircleAlert size={20} />
              <div className="confirm-copy">
                <strong>Confirm full payment?</strong>
                <p>{clientName}{existing.refNumber ? ` · ${existing.refNumber}` : ""} · {existing.amount == null ? "No amount entered" : peso(existing.amount)}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setShowPaymentConfirm(false)}>Cancel</Button>
              <Button type="button" onClick={() => { void confirmPaid(); }}>Confirm payment</Button>
            </div>
          )}
          {showDeleteConfirm && existing && (
            <div className="confirm-payment confirm-delete">
              <CircleAlert size={20} />
              <div className="confirm-copy">
                <strong>Delete this SOA?</strong>
                <p>This permanently removes {existing.refNumber || "this statement"}{existing.amount == null ? "" : ` · ${peso(existing.amount)}`}.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button type="button" className="delete-action" disabled={deleteSoa.isPending} onClick={() => { void confirmDelete(); }}>Delete SOA</Button>
            </div>
          )}

          <div className="form-footer">
            <div className="form-footer-note">
              {existing ? "Changes are saved to your Supabase ledger." : "All fields are optional; save what you have."}
            </div>
            <div className="footer-actions">
              {existing && (
                <Button type="button" variant="outline" className="delete-outline" disabled={deleteSoa.isPending} onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 size={15} />Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={returnToList}>Cancel</Button>
              <Button type="submit" className="save-button" disabled={duplicateRef || Boolean(amountError) || saveSoa.isPending}>
                <Save size={16} />Save SOA
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
