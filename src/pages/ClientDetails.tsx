import { FormEvent, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ChevronDown, CircleAlert, Phone, Pencil, Printer, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { LedgerState } from "@/components/LedgerState";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusQuickAction } from "@/components/StatusQuickAction";
import { currentManilaYear, ledgerYears, peso } from "@/lib/soa";
import { errorMessage, useClients, useDeleteClient, useSaveClient, useSoas, type Client, type ViewSoa } from "@/lib/tracker";

const nameOf = (name: string | null | undefined) => name?.trim() || "Unnamed agency";
const dateText = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function ClientDetails({ clientId }: { clientId: string }) {
  const clientsQuery = useClients();
  const soasQuery = useSoas();
  if (!clientsQuery.data || !soasQuery.data) return <AppShell><div className="page-wrap"><LedgerState isLoading={clientsQuery.isLoading || soasQuery.isLoading} error={clientsQuery.error ?? soasQuery.error} /></div></AppShell>;
  const client = clientsQuery.data.find(item => item.id === clientId);
  if (!client) return <AppShell><div className="page-wrap"><div className="empty-state"><h2>Agency not found</h2><p>That agency isn’t in your ledger.</p><Link href="/">Back to Dashboard</Link></div></div></AppShell>;
  return <ClientAccount key={client.id} client={client} soas={soasQuery.data} />;
}

function ClientAccount({ client, soas }: { client: Client; soas: ViewSoa[] }) {
  const saveClient = useSaveClient();
  const deleteClient = useDeleteClient();
  const [, setLocation] = useLocation();
  const initialParams = new URLSearchParams(window.location.search);
  const [year, setYear] = useState(Number(initialParams.get("year")) || currentManilaYear());
  const search = initialParams.get("q") ?? "";
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [name, setName] = useState(client.name ?? "");
  const [contactName, setContactName] = useState(client.contactName ?? "");
  const [contact, setContact] = useState(client.contactNumber ?? "");
  const years = useMemo(
    () => ledgerYears(soas.filter(record => record.clientId === client.id).map(record => record.date)),
    [client.id, soas],
  );
  const linkedSoas = soas.filter(record => record.clientId === client.id);
  const records = linkedSoas.filter(record => record.date && Number(record.date.slice(0, 4)) === year).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const billed = records.reduce((sum, record) => sum + (record.amount ?? 0), 0);
  const due = records.filter(record => record.status !== "Paid").reduce((sum, record) => sum + (record.amount ?? 0), 0);
  const paid = records.filter(record => record.status === "Paid").reduce((sum, record) => sum + (record.amount ?? 0), 0);
  const query = `?year=${year}&q=${encodeURIComponent(search)}`;
  const printedOn = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await saveClient.mutateAsync({ id: client.id, name, contactName, contactNumber: contact });
      setEditing(false);
      toast.success("Agency updated");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteClient.mutateAsync(client.id);
      toast.success("Agency deleted");
      setLocation(`/${query}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const startEdit = () => {
    setName(client.name ?? "");
    setContactName(client.contactName ?? "");
    setContact(client.contactNumber ?? "");
    setEditing(value => !value);
  };

  return <AppShell><div className="page-wrap agency-print-page">
    <Link href={`/${query}`} className="back-link no-print"><ArrowLeft size={16} />Back to Dashboard</Link>
    <div className="page-heading detail-heading">
      <div>
        <div className="eyebrow">AGENCY ACCOUNT</div>
        <h1>{nameOf(client.name)}</h1>
        <div className="agency-contact-block">
          <p className="contact-line"><UserRound size={15} />{client.contactName?.trim() || "—"}</p>
          <p className="contact-line"><Phone size={15} />{client.contactNumber || "—"}</p>
        </div>
        <p className="print-only print-meta">Year {year} · Printed {printedOn}</p>
      </div>
      <div className="heading-actions no-print">
        <label className="year-picker">
          <span>YEAR</span>
          <select aria-label="Agency billing year" value={year} onChange={event => setYear(Number(event.target.value))}>
            {years.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <ChevronDown size={15} />
        </label>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer size={15} />Print
        </Button>
        <Button variant="outline" onClick={startEdit}>
          <Pencil size={15} />Edit agency
        </Button>
        <Button variant="outline" className="delete-outline" onClick={() => setShowDeleteConfirm(true)}>
          <Trash2 size={15} />Delete
        </Button>
      </div>
    </div>
    {editing && (
      <form className="client-edit-panel no-print" onSubmit={save}>
        <div className="client-edit-heading">
          <div><strong>Edit agency</strong><p>All fields can be left blank.</p></div>
          <button type="button" className="icon-button" onClick={() => setEditing(false)} aria-label="Close edit agency"><X size={16} /></button>
        </div>
        <div className="form-grid">
          <label className="form-field"><span>Agency</span><input value={name} onChange={event => setName(event.target.value)} placeholder="Agency name" /></label>
          <label className="form-field"><span>Contact name</span><input value={contactName} onChange={event => setContactName(event.target.value)} placeholder="Contact person" /></label>
          <label className="form-field"><span>Contact number</span><input value={contact} onChange={event => setContact(event.target.value)} placeholder="e.g. +63 917 123 4567" /></label>
        </div>
        <div className="footer-actions">
          <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          <Button type="submit" disabled={saveClient.isPending}>Save agency</Button>
        </div>
      </form>
    )}
    {showDeleteConfirm && (
      <div className="confirm-payment confirm-delete no-print">
        <CircleAlert size={20} />
        <div className="confirm-copy">
          <strong>Delete this agency?</strong>
          <p>{linkedSoas.length ? `${linkedSoas.length} linked ${linkedSoas.length === 1 ? "SOA will become" : "SOAs will become"} Unassigned. The statements themselves are kept.` : "This agency has no linked SOAs."}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
        <Button type="button" className="delete-action" disabled={deleteClient.isPending} onClick={() => { void confirmDelete(); }}>Delete agency</Button>
      </div>
    )}
    <section className="client-stats">
      <article><span>Transactions</span><strong>{records.length}</strong><small>SOAs dated in {year}</small></article>
      <article><span>Total billed</span><strong>{peso(billed)}</strong><small>Paid {peso(paid)}</small></article>
      <article><span>Outstanding balance</span><strong>{peso(due)}</strong><small>Unpaid and overdue</small></article>
    </section>
    <section className="table-panel agency-history-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">ACCOUNT HISTORY</div>
          <h2>Statements of Account</h2>
          <p>{records.length} {records.length === 1 ? "SOA" : "SOAs"} · {year}</p>
        </div>
      </div>
      {records.length ? (
        <>
          <div className="table-scroll desktop-only print-table-wrap">
            <table className="data-table client-history-table">
              <thead>
                <tr>
                  <th>Ref #</th>
                  <th>Date</th>
                  <th className="numeric">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map(row => (
                  <tr
                    key={row.id}
                    className="clickable-row"
                    onClick={() => { window.location.href = `/soa/${row.id}?year=${year}`; }}
                    tabIndex={0}
                    onKeyDown={event => { if (event.key === "Enter") window.location.href = `/soa/${row.id}?year=${year}`; }}
                  >
                    <td className="ref-cell">{row.refNumber || "—"}</td>
                    <td>{dateText(row.date)}</td>
                    <td className="numeric money">{row.amount == null ? "—" : peso(row.amount)}</td>
                    <td>
                      <div className="status-cell">
                        <StatusBadge status={row.status} />
                        <span className="no-print"><StatusQuickAction record={row} /></span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="print-only">
                <tr>
                  <td colSpan={2}>Totals</td>
                  <td className="numeric money">{peso(billed)}</td>
                  <td>Outstanding {peso(due)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mobile-soa-cards no-print">
            {records.map(row => (
              <div key={row.id} className="mobile-soa-card-shell">
                <Link href={`/soa/${row.id}?year=${year}`} className="soa-mobile-card">
                  <div className="soa-mobile-top"><strong className="soa-agency-primary">{row.refNumber || "No reference"}</strong><StatusBadge status={row.status} /></div>
                  <div className="soa-mobile-meta"><span>{dateText(row.date)}</span><b>{row.amount == null ? "—" : peso(row.amount)}</b></div>
                </Link>
                <div className="mobile-quick-status"><StatusQuickAction record={row} /></div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state compact-empty">
          <h3>No SOAs for {year}</h3>
          <p>This agency has no statements dated in the selected year.</p>
          <Link href="/soa/new" className="text-link no-print">Add an SOA →</Link>
        </div>
      )}
    </section>
  </div></AppShell>;
}
