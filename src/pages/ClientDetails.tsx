import { FormEvent, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ChevronDown, Phone, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { LedgerState } from "@/components/LedgerState";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusQuickAction } from "@/components/StatusQuickAction";
import { currentManilaYear, peso } from "@/lib/soa";
import { errorMessage, useClients, useSaveClient, useSoas, type Client, type ViewSoa } from "@/lib/tracker";

const nameOf = (name: string | null | undefined) => name?.trim() || "Unnamed client";
const dateText = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function ClientDetails({ clientId }: { clientId: string }) {
  const clientsQuery = useClients();
  const soasQuery = useSoas();
  if (!clientsQuery.data || !soasQuery.data) return <AppShell><div className="page-wrap"><LedgerState isLoading={clientsQuery.isLoading || soasQuery.isLoading} error={clientsQuery.error ?? soasQuery.error} /></div></AppShell>;
  const client = clientsQuery.data.find(item => item.id === clientId);
  if (!client) return <AppShell><div className="page-wrap"><div className="empty-state"><h2>Client not found</h2><p>That client isn’t in your ledger.</p><Link href="/">Back to Dashboard</Link></div></div></AppShell>;
  return <ClientAccount key={client.id} client={client} soas={soasQuery.data} />;
}

function ClientAccount({ client, soas }: { client: Client; soas: ViewSoa[] }) {
  const saveClient = useSaveClient();
  const initialParams = new URLSearchParams(window.location.search);
  const [year, setYear] = useState(Number(initialParams.get("year")) || currentManilaYear());
  const search = initialParams.get("q") ?? "";
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(client.name ?? "");
  const [contact, setContact] = useState(client.contactNumber ?? "");
  const years = useMemo(() => [...new Set([currentManilaYear(), currentManilaYear() - 1, currentManilaYear() - 2, ...soas.filter(record => record.clientId === client.id && record.date).map(record => Number(record.date!.slice(0, 4)))])].sort((a, b) => b - a), [client.id, soas]);
  const records = soas.filter(record => record.clientId === client.id && record.date && Number(record.date.slice(0, 4)) === year).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const billed = records.reduce((sum, record) => sum + (record.amount ?? 0), 0);
  const due = records.filter(record => record.status !== "Paid").reduce((sum, record) => sum + (record.amount ?? 0), 0);
  const query = `?year=${year}&q=${encodeURIComponent(search)}`;
  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await saveClient.mutateAsync({ id: client.id, name, contactNumber: contact });
      setEditing(false);
      toast.success("Client updated");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return <AppShell><div className="page-wrap">
    <Link href={`/${query}`} className="back-link"><ArrowLeft size={16} />Back to Dashboard</Link>
    <div className="page-heading detail-heading"><div><div className="eyebrow">CLIENT ACCOUNT</div><h1>{nameOf(client.name)}</h1><p className="contact-line"><Phone size={15} />{client.contactNumber || "—"}</p></div><div className="heading-actions"><label className="year-picker"><span>YEAR</span><select aria-label="Client billing year" value={year} onChange={event => setYear(Number(event.target.value))}>{years.map(option => <option key={option}>{option}</option>)}</select><ChevronDown size={15} /></label><Button variant="outline" onClick={() => { setName(client.name ?? ""); setContact(client.contactNumber ?? ""); setEditing(value => !value); }}><Pencil size={15} />Edit client</Button></div></div>
    {editing && <form className="client-edit-panel" onSubmit={save}><div className="client-edit-heading"><div><strong>Edit client</strong><p>Both fields can be left blank.</p></div><button type="button" className="icon-button" onClick={() => setEditing(false)} aria-label="Close edit client"><X size={16} /></button></div><div className="form-grid"><label className="form-field"><span>Client name</span><input value={name} onChange={event => setName(event.target.value)} placeholder="Name" /></label><label className="form-field"><span>Contact number</span><input value={contact} onChange={event => setContact(event.target.value)} placeholder="e.g. +63 917 123 4567" /></label></div><div className="footer-actions"><Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button><Button type="submit" disabled={saveClient.isPending}>Save client</Button></div></form>}
    <section className="client-stats"><article><span>Deals</span><strong>{records.length}</strong><small>SOAs dated in {year}</small></article><article><span>Total billed</span><strong>{peso(billed)}</strong><small>Including paid SOAs</small></article><article><span>Outstanding balance</span><strong>{peso(due)}</strong><small>Unpaid and overdue</small></article></section>
    <section className="table-panel"><div className="section-heading"><div><div className="eyebrow">ACCOUNT HISTORY</div><h2>Statements of Account</h2><p>{records.length} {records.length === 1 ? "SOA" : "SOAs"} · {year}</p></div></div>
      {records.length ? <><div className="table-scroll desktop-only"><table className="data-table client-history-table"><thead><tr><th>Ref #</th><th>Agency</th><th>Date</th><th className="numeric">Amount</th><th>Status</th></tr></thead><tbody>{records.map(row => <tr key={row.id} className="clickable-row" onClick={() => { window.location.href = `/soa/${row.id}?year=${year}` }} tabIndex={0} onKeyDown={event => { if (event.key === "Enter") window.location.href = `/soa/${row.id}?year=${year}` }}><td className="ref-cell">{row.refNumber || "—"}</td><td>{row.agency || "—"}</td><td>{dateText(row.date)}</td><td className="numeric money">{row.amount == null ? "—" : peso(row.amount)}</td><td><div className="status-cell"><StatusBadge status={row.status} /><StatusQuickAction record={row} /></div></td></tr>)}</tbody></table></div><div className="mobile-soa-cards">{records.map(row => <div key={row.id} className="mobile-soa-card-shell"><Link href={`/soa/${row.id}?year=${year}`} className="soa-mobile-card"><div className="soa-mobile-top"><strong>{row.refNumber || "No reference"}</strong><StatusBadge status={row.status} /></div><div className="soa-mobile-agency">{row.agency || "—"}</div><div className="soa-mobile-meta"><span>{dateText(row.date)}</span><b>{row.amount == null ? "—" : peso(row.amount)}</b></div></Link><div className="mobile-quick-status"><StatusQuickAction record={row} /></div></div>)}</div></> : <div className="empty-state compact-empty"><h3>No SOAs for {year}</h3><p>This client has no statements dated in the selected year.</p><Link href="/soa/new" className="text-link">Add an SOA →</Link></div>}
    </section>
  </div></AppShell>;
}
