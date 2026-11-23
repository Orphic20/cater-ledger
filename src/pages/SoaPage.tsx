import { useMemo, useState } from "react";
import { ChevronDown, FilePlus2, Search, X } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusQuickAction } from "@/components/StatusQuickAction";
import { LedgerState } from "@/components/LedgerState";
import { currentManilaYear, peso } from "@/lib/soa";
import { useClients, useSoas } from "@/lib/tracker";

const readableDate = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const refOrder = (ref: string | null) => { const match = ref?.match(/\d+/); return match ? Number(match[0]) : -1; };
const labelAgency = (name: string | null | undefined) => name?.trim() || "Unnamed agency";

export default function SoaPage() {
  const clientsQuery = useClients();
  const soasQuery = useSoas();
  const [year, setYear] = useState(() => new URLSearchParams(window.location.search).get("year") || String(currentManilaYear()));
  const [clientId, setClientId] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const clients = clientsQuery.data ?? [];
  const soas = soasQuery.data ?? [];
  const clientById = (id: string | null) => clients.find(client => client.id === id);
  const years = useMemo(() => [...new Set([currentManilaYear(), currentManilaYear() - 1, ...soas.flatMap(record => record.date ? [Number(record.date.slice(0, 4))] : [])])].sort((a, b) => b - a), [soas]);
  if (!clientsQuery.data || !soasQuery.data) return <AppShell><div className="page-wrap"><LedgerState isLoading={clientsQuery.isLoading || soasQuery.isLoading} error={clientsQuery.error ?? soasQuery.error} /></div></AppShell>;
  const filtered = soas.filter(record => year === "all" || year === "nodate" ? year === "all" || !record.date : record.date?.startsWith(`${year}-`))
    .filter(record => clientId === "all" || clientId === "unassigned" ? clientId === "all" || !record.clientId : record.clientId === clientId)
    .filter(record => status === "all" || record.status === status)
    .filter(record => {
      const client = clientById(record.clientId);
      return `${record.refNumber ?? ""} ${record.agency ?? ""} ${client?.name ?? "Unassigned"}`.toLowerCase().includes(search.toLowerCase());
    }).sort((a, b) => refOrder(b.refNumber) - refOrder(a.refNumber) || (b.date ?? "").localeCompare(a.date ?? ""));
  const clearFilters = () => { setYear(String(currentManilaYear())); setClientId("all"); setStatus("all"); setSearch(""); };

  return <AppShell><div className="page-wrap">
    <div className="page-heading soa-heading"><div><div className="eyebrow">BILLING RECORDS</div><h1>Statements of Account</h1><p>Keep agency billing and payment status up to date.</p></div><Button className="add-button" onClick={() => { window.location.href = "/soa/new" }}><FilePlus2 size={17} />+ Add SOA</Button></div>
    <section className="table-panel soa-panel"><div className="filters-row"><label className="filter-select"><span>YEAR</span><strong>{year === "all" ? "All dates" : year === "nodate" ? "No date" : year}</strong><select aria-label="Year filter" value={year} onChange={event => setYear(event.target.value)}><option value="all">All dates</option>{years.map(option => <option key={option} value={option}>{option}</option>)}<option value="nodate">No date</option></select><ChevronDown size={14} /></label><label className="filter-select"><span>AGENCY</span><strong>{clientId === "all" ? "All agencies" : clientId === "unassigned" ? "Unassigned" : labelAgency(clients.find(client => client.id === clientId)?.name)}</strong><select aria-label="Agency filter" value={clientId} onChange={event => setClientId(event.target.value)}><option value="all">All agencies</option><option value="unassigned">Unassigned</option>{clients.map(client => <option key={client.id} value={client.id}>{labelAgency(client.name)}</option>)}</select><ChevronDown size={14} /></label><label className="filter-select"><span>STATUS</span><strong>{status === "all" ? "All statuses" : status}</strong><select aria-label="Status filter" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option>Paid</option><option>Unpaid</option><option>Overdue</option></select><ChevronDown size={14} /></label><label className="client-search soa-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search ref or agency" aria-label="Search SOAs" /></label><Button className="clear-filter-button" variant="ghost" onClick={clearFilters}><X size={14} />Clear filters</Button></div>
      {filtered.length ? <><div className="table-scroll desktop-only"><table className="data-table soa-table"><thead><tr><th>Ref #</th><th>Agency</th><th>Date</th><th className="numeric">Amount</th><th>Status</th></tr></thead><tbody>{filtered.map(row => { const agencyLabel = labelAgency(clientById(row.clientId)?.name) === "Unnamed agency" && !row.clientId ? (row.agency || "Unassigned") : (clientById(row.clientId)?.name?.trim() || row.agency || "—"); return <tr key={row.id} className="clickable-row" onClick={() => { window.location.href = `/soa/${row.id}?year=${encodeURIComponent(year)}` }} tabIndex={0} onKeyDown={event => { if (event.key === "Enter") window.location.href = `/soa/${row.id}?year=${encodeURIComponent(year)}` }}><td className="ref-cell">{row.refNumber || "—"}</td><td>{agencyLabel}</td><td>{readableDate(row.date)}</td><td className="numeric money">{row.amount == null ? "—" : peso(row.amount)}</td><td><div className="status-cell"><StatusBadge status={row.status} /><StatusQuickAction record={row} /></div></td></tr>; })}</tbody></table></div><div className="mobile-soa-cards">{filtered.map(row => { const agencyLabel = row.clientId ? labelAgency(clientById(row.clientId)?.name) : (row.agency || "Unassigned"); return <div key={row.id} className="mobile-soa-card-shell"><Link href={`/soa/${row.id}?year=${encodeURIComponent(year)}`} className="soa-mobile-card"><div className="soa-mobile-top"><strong>{row.refNumber || "No reference"}</strong><StatusBadge status={row.status} /></div><div className="soa-mobile-agency">{agencyLabel}</div><div className="soa-mobile-meta"><span>{readableDate(row.date)}</span><b>{row.amount == null ? "—" : peso(row.amount)}</b></div></Link><div className="mobile-quick-status"><StatusQuickAction record={row} /></div></div>; })}</div></> : <div className="empty-state"><span className="empty-icon"><FilePlus2 size={20} /></span><h3>No SOAs match these filters</h3><p>Try changing the filters, or add a new statement.</p><Button variant="outline" onClick={() => { window.location.href = "/soa/new" }}>+ Add SOA</Button></div>}
      <div className="table-bottom-note">{filtered.length} {filtered.length === 1 ? "SOA" : "SOAs"} · Blank due dates remain Unpaid.</div>
    </section>
  </div></AppShell>;
}
