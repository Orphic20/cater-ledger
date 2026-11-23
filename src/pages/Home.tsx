import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowDownRight, ArrowUpRight, ChevronDown, CircleAlert, CircleCheck, CircleDashed, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LedgerState } from "@/components/LedgerState";
import { currentManilaYear, peso } from "@/lib/soa";
import { useClients, useSoas } from "@/lib/tracker";

function agencyName(value: string | null | undefined) {
  return value?.trim() || "Unnamed agency";
}

function selectedYear() {
  return Number(new URLSearchParams(window.location.search).get("year")) || currentManilaYear();
}

export default function Home() {
  const clientsQuery = useClients();
  const soasQuery = useSoas();
  const [, setLocation] = useLocation();
  const [year, setYear] = useState(selectedYear());
  const [search, setSearch] = useState(new URLSearchParams(window.location.search).get("q") ?? "");
  const clients = clientsQuery.data ?? [];
  const soas = soasQuery.data ?? [];
  const years = useMemo(
    () => [...new Set([currentManilaYear(), currentManilaYear() - 1, currentManilaYear() - 2, ...soas.flatMap(item => item.date ? [Number(item.date.slice(0, 4))] : [])])].sort((a, b) => b - a),
    [soas],
  );
  if (!clientsQuery.data || !soasQuery.data) {
    return <AppShell><div className="page-wrap"><LedgerState isLoading={clientsQuery.isLoading || soasQuery.isLoading} error={clientsQuery.error ?? soasQuery.error} /></div></AppShell>;
  }

  const yearly = soas.filter(record => record.date && Number(record.date.slice(0, 4)) === year);
  const totalBilled = yearly.reduce((sum, record) => sum + (record.amount ?? 0), 0);
  const outstanding = yearly.filter(record => record.status !== "Paid").reduce((sum, record) => sum + (record.amount ?? 0), 0);
  const statusTotals = ["Paid", "Unpaid", "Overdue"].map(status => ({
    status,
    amount: yearly.filter(record => record.status === status).reduce((sum, record) => sum + (record.amount ?? 0), 0),
    count: yearly.filter(record => record.status === status).length,
  }));
  const largestBar = Math.max(1, ...statusTotals.map(item => item.amount));

  const clientRows = clients.map(client => {
    const records = yearly.filter(record => record.clientId === client.id);
    return {
      client,
      agency: agencyName(client.name),
      billed: records.reduce((sum, row) => sum + (row.amount ?? 0), 0),
      due: records.filter(row => row.status !== "Paid").reduce((sum, row) => sum + (row.amount ?? 0), 0),
    };
  }).filter(row => `${row.agency} ${row.client.contactNumber ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const clientQuery = `?year=${year}&q=${encodeURIComponent(search)}`;

  return <AppShell><div className="page-wrap">
    <div className="page-heading dashboard-heading">
      <div>
        <div className="eyebrow">YOUR CATERING BUSINESS</div>
        <h1>A clear view of every account.</h1>
        <p>Track agency billing and payments at a glance.</p>
      </div>
      <label className="year-picker">
        <span>YEAR</span>
        <strong>{year}</strong>
        <select aria-label="Year" value={year} onChange={event => setYear(Number(event.target.value))}>
          {years.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <ChevronDown size={15} />
      </label>
    </div>

    <section className="summary-grid" aria-label={`Summary for ${year}`}>
      <article className="summary-card billed-card">
        <div className="summary-top"><span>Total billed</span><span className="summary-icon green-icon"><ArrowUpRight size={18} /></span></div>
        <strong>{peso(totalBilled)}</strong>
        <small>All dated SOAs, including paid</small>
      </article>
      <article className="summary-card due-card prominent-balance">
        <div className="summary-top"><span>Outstanding balance</span><span className="summary-icon amber-icon"><ArrowDownRight size={18} /></span></div>
        <strong>{peso(outstanding)}</strong>
        <small>Unpaid and overdue amounts</small>
      </article>
    </section>

    <section className="table-panel client-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">AGENCIES</div>
          <h2>Agency accounts</h2>
          <p>Agency · total · remaining balance · {year}</p>
        </div>
        <label className="client-search">
          <Search size={17} />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search agency" aria-label="Search by agency" />
        </label>
      </div>
      {clientRows.length ? (
        <>
          <div className="table-scroll desktop-only">
            <table className="data-table client-table">
              <thead>
                <tr>
                  <th>Agency</th>
                  <th className="numeric">Total</th>
                  <th className="numeric">Remaining balance</th>
                </tr>
              </thead>
              <tbody>
                {clientRows.map(({ client, agency, billed, due }) => (
                  <tr
                    key={client.id}
                    className="clickable-row"
                    onClick={() => setLocation(`/clients/${client.id}${clientQuery}`)}
                    tabIndex={0}
                    onKeyDown={event => { if (event.key === "Enter") setLocation(`/clients/${client.id}${clientQuery}`); }}
                  >
                    <td>
                      <Link href={`/clients/${client.id}${clientQuery}`} className="client-name-link" onClick={event => event.stopPropagation()}>
                        {agency}
                      </Link>
                    </td>
                    <td className="numeric money">{peso(billed)}</td>
                    <td className="numeric money outstanding-cell">{peso(due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-client-cards">
            {clientRows.map(({ client, agency, billed, due }) => (
              <Link key={client.id} href={`/clients/${client.id}${clientQuery}`} className="client-card">
                <div className="client-card-title"><strong>{agency}</strong></div>
                <div className="client-card-money">
                  <div><small>Total</small><b>{peso(billed)}</b></div>
                  <div><small>Remaining</small><b>{peso(due)}</b></div>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h3>{search ? "No matching agencies" : clients.length ? `No agency activity for ${year}` : "No agencies yet"}</h3>
          <p>{search ? "Try another agency name." : "Add an SOA and link an agency to see totals here."}</p>
          <Link href="/soa/new" className="text-link">Add an SOA →</Link>
        </div>
      )}
    </section>

    <section className="chart-panel">
      <div className="chart-heading">
        <div><div className="eyebrow">PAYMENT STATUS</div><h2>Billing by status</h2></div>
        <span className="chart-period">{year} · dated SOAs</span>
      </div>
      <div className="status-bars">
        {statusTotals.map(item => {
          const Icon = item.status === "Paid" ? CircleCheck : item.status === "Overdue" ? CircleAlert : CircleDashed;
          return (
            <div className="status-bar-row" key={item.status}>
              <div className="status-bar-label">
                <span className={`status-dot ${item.status.toLowerCase()}`}><Icon size={15} /></span>
                <span>{item.status}</span>
                <small>{item.count} {item.count === 1 ? "SOA" : "SOAs"}</small>
              </div>
              <div className="status-bar-track">
                <div className={`status-bar-fill ${item.status.toLowerCase()}`} style={{ width: `${item.amount ? Math.max(7, item.amount / largestBar * 100) : 0}%` }} />
              </div>
              <strong>{peso(item.amount)}</strong>
            </div>
          );
        })}
      </div>
    </section>
    <p className="dashboard-footnote">Each row is an agency. Unassigned dated SOAs are included in the summary cards and status chart.</p>
  </div></AppShell>;
}
