import { FormEvent, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ChevronDown, CircleAlert, Phone, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { LedgerState } from "@/components/LedgerState";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusQuickAction } from "@/components/StatusQuickAction";
import { currentManilaYear, peso } from "@/lib/soa";
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
  const [contact, setContact] = useState(client.contactNumber ?? "");
  const years = useMemo(() => [...new Set([currentManilaYear(), currentManilaYear() - 1, currentManilaYear() - 2, ...soas.filter(record => record.clientId === client.id && record.date).map(record => Number(record.date!.slice(0, 4)))])].sort((a, b) => b - a), [client.id, soas]);
  const linkedSoas = soas.filter(record => record.clientId === client.id);
  const records = linkedSoas.filter(record => record.date && Number(record.date.slice(0, 4)) === year).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const billed = records.reduce((sum, record) => sum + (record.amount ?? 0), 0);
  const due = records.filter(record => record.status !== "Paid").reduce((sum, record) => sum + (record.amount ?? 0), 0);
  const query = `?year=${year}&q=${encodeURIComponent(search)}`;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await saveClient.mutateAsync({ id: client.id, name, contactNumber: contact });
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

  return <AppShell><div className="page-wrap">
    <Link href={`/${query}`} className="back-link"><ArrowLeft size={16} />Back to Dashboard</Link>
    <div className="page-heading detail-heading">
      <div>
        <div className="eyebrow">AGENCY ACCOUNT</div>
        <h1>{nameOf(client.name)}</h1>
        <p className="contact-line"><Phone size={15} />{client.contactNumber || "—"}</p>
      </div>
      <div className="heading-actions">
        <label className="year-picker">
          <span>YEAR</span>
          <select aria-label="Agency billing year" value={year} onChange={event => setYear(Number(event.target.value))}>
            {years.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <ChevronDown size={15} />
        </label>
        <Button variant="outline" onClick={() => { setName(client.name ?? ""); setContact(client.contactNumber ?? ""); setEditing(value => !value); }}>
          <Pencil size={15} />Edit agency
        </Button>
        <Button variant="outline" className="delete-outline" onClick={() => setShowDeleteConfirm(true)}>
          <Trash2 size={15} />Delete
        </Button>
      </div>
    </div>
    {editing && (
      <form className="client-edit-panel" onSubmit={save}>
        <div className="client-edit-heading">
          <div><strong>Edit agency</strong><p>Both fields can be left blank.</p></div>
          <button type="button" className="icon-button" onClick={() => setEditing(false)} aria-label="Close edit agency"><X size={16} /></button>
        </div>
        <div className="form-grid">
          <label className="form-field"><span>Agency</span><input value={name} onChange={event => setName(event.target.value)} placeholder="Agency name" /></label>
          <label className="form-field"><span>Contact number</span><input value={contact} onChange={event => setContact(event.target.value)} placeholder="e.g. +63 917 123 4567" /></label>
        </div>
        <div className="footer-actions">
          <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          <Button type="submit" disabled={saveClient.isPending}>Save agency</Button>
        </div>
      </form>
    )}
    {showDeleteConfirm && (
      <div className="confirm-payment confirm-delete">
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
      <article><span>Deals</span><strong>{records.length}</strong><small>SOAs dated in {year}</small></article>
      <article><span>Total billed</span><strong>{peso(billed)}</strong><small>Including paid SOAs</small></article>
      <article><span>Outstanding balance</span><strong>{peso(due)}</strong><small>Unpaid and overdue</small></article>
    </section>
    <section className="table-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">ACCOUNT HISTORY</div>
          <h2>Statements of Account</h2>
          <p>{records.length} {records.length === 1 ? "SOA" : "SOAs"} · {year}</p>
        </div>
      </div>
      {records.length ? (
        <>
          <div className="table-scroll desktop-only">
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
                    <td><div className="status-cell"><StatusBadge status={row.status} /><StatusQuickAction record={row} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-soa-cards">
            {records.map(row => (
              <div key={row.id} className="mobile-soa-card-shell">
                <Link href={`/soa/${row.id}?year=${year}`} className="soa-mobile-card">
                  <div className="soa-mobile-top"><strong>{row.refNumber || "No reference"}</strong><StatusBadge status={row.status} /></div>
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
          <Link href="/soa/new" className="text-link">Add an SOA →</Link>
        </div>
      )}
    </section>
  </div></AppShell>;
}
