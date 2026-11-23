import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LedgerState } from "@/components/LedgerState";
import { currentManilaYear, peso } from "@/lib/soa";
import { useClients, useSoas } from "@/lib/tracker";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function displayName(value: string | null | undefined) {
  return value?.trim() || "Unnamed client";
}

export default function InsightsPage() {
  const clientsQuery = useClients();
  const soasQuery = useSoas();
  const [year, setYear] = useState(currentManilaYear());
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
  const deals = yearly.length;
  const totalBilled = yearly.reduce((sum, record) => sum + (record.amount ?? 0), 0);
  const outstanding = yearly.filter(record => record.status !== "Paid").reduce((sum, record) => sum + (record.amount ?? 0), 0);
  const paidAmount = yearly.filter(record => record.status === "Paid").reduce((sum, record) => sum + (record.amount ?? 0), 0);
  const collectionRate = totalBilled > 0 ? Math.round((paidAmount / totalBilled) * 100) : 0;

  const statusTotals = (["Paid", "Unpaid", "Overdue"] as const).map(status => ({
    status,
    amount: yearly.filter(record => record.status === status).reduce((sum, record) => sum + (record.amount ?? 0), 0),
    count: yearly.filter(record => record.status === status).length,
  }));
  const largestStatus = Math.max(1, ...statusTotals.map(item => item.amount));

  const monthly = MONTHS.map((label, index) => {
    const month = String(index + 1).padStart(2, "0");
    const records = yearly.filter(record => record.date?.slice(5, 7) === month);
    const billed = records.reduce((sum, record) => sum + (record.amount ?? 0), 0);
    const due = records.filter(record => record.status !== "Paid").reduce((sum, record) => sum + (record.amount ?? 0), 0);
    return { label, billed, due, deals: records.length };
  });
  const largestMonth = Math.max(1, ...monthly.map(item => item.billed));

  const topClients = [...clients.map(client => {
    const records = yearly.filter(record => record.clientId === client.id);
    return {
      id: client.id,
      name: displayName(client.name),
      deals: records.length,
      billed: records.reduce((sum, record) => sum + (record.amount ?? 0), 0),
      due: records.filter(record => record.status !== "Paid").reduce((sum, record) => sum + (record.amount ?? 0), 0),
    };
  }), (() => {
    const records = yearly.filter(record => !record.clientId);
    return {
      id: "unassigned",
      name: "Unassigned",
      deals: records.length,
      billed: records.reduce((sum, record) => sum + (record.amount ?? 0), 0),
      due: records.filter(record => record.status !== "Paid").reduce((sum, record) => sum + (record.amount ?? 0), 0),
    };
  })()]
    .filter(row => row.deals > 0)
    .sort((a, b) => b.billed - a.billed)
    .slice(0, 8);
  const largestClient = Math.max(1, ...topClients.map(item => item.billed));

  const eventMonths = MONTHS.map((label, index) => {
    const month = String(index + 1).padStart(2, "0");
    const count = soas.filter(record => record.eventDate?.startsWith(`${year}-${month}-`)).length;
    return { label, count };
  });
  const largestEvents = Math.max(1, ...eventMonths.map(item => item.count));

  return <AppShell><div className="page-wrap insights-page">
    <div className="page-heading dashboard-heading">
      <div>
        <div className="eyebrow">INSIGHTS</div>
        <h1>Billing and collections at a glance.</h1>
        <p>See monthly billing, payment status, and which clients drive the year.</p>
      </div>
      <label className="year-picker">
        <span>YEAR</span>
        <select aria-label="Insights year" value={year} onChange={event => setYear(Number(event.target.value))}>
          {years.map(option => <option key={option}>{option}</option>)}
        </select>
        <ChevronDown size={15} />
      </label>
    </div>

    <section className="insights-kpis" aria-label={`Key numbers for ${year}`}>
      <article><span>Deals</span><strong>{deals}</strong><small>Dated SOAs in {year}</small></article>
      <article><span>Total billed</span><strong>{peso(totalBilled)}</strong><small>Including paid</small></article>
      <article className="kpi-emphasis"><span>Outstanding</span><strong>{peso(outstanding)}</strong><small>Unpaid + overdue</small></article>
      <article><span>Collected</span><strong>{collectionRate}%</strong><small>{peso(paidAmount)} paid</small></article>
    </section>

    {!yearly.length ? (
      <div className="empty-state table-panel">
        <h3>No dated SOAs for {year}</h3>
        <p>Add statements with an SOA date to build these charts.</p>
        <Link href="/soa/new" className="text-link">Add an SOA →</Link>
      </div>
    ) : (
      <>
        <section className="chart-panel insights-panel">
          <div className="chart-heading">
            <div><div className="eyebrow">MONTHLY BILLING</div><h2>Billed by month</h2></div>
            <span className="chart-period">{year} · by SOA date</span>
          </div>
          <div className="month-chart" role="img" aria-label={`Monthly billed amounts for ${year}`}>
            {monthly.map(item => (
              <div className="month-col" key={item.label}>
                <div className="month-bars">
                  <div
                    className="month-bar billed"
                    style={{ height: `${item.billed ? Math.max(8, (item.billed / largestMonth) * 100) : 0}%` }}
                    title={`Billed ${peso(item.billed)}`}
                  />
                  <div
                    className="month-bar due"
                    style={{ height: `${item.due ? Math.max(6, (item.due / largestMonth) * 100) : 0}%` }}
                    title={`Outstanding ${peso(item.due)}`}
                  />
                </div>
                <strong>{item.label}</strong>
                <small>{item.deals || "—"}</small>
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <span><i className="legend-swatch billed" />Billed</span>
            <span><i className="legend-swatch due" />Still outstanding</span>
          </div>
        </section>

        <div className="insights-split">
          <section className="chart-panel insights-panel">
            <div className="chart-heading">
              <div><div className="eyebrow">PAYMENT STATUS</div><h2>Amount by status</h2></div>
              <span className="chart-period">{year}</span>
            </div>
            <div className="status-bars">
              {statusTotals.map(item => {
                const Icon = item.status === "Paid" ? CircleCheck : item.status === "Overdue" ? CircleAlert : CircleDashed;
                return (
                  <div className="status-bar-row" key={item.status}>
                    <div className="status-bar-label">
                      <span className={`status-dot ${item.status.toLowerCase()}`}><Icon size={15} /></span>
                      <span>{item.status}</span>
                      <small>{item.count}</small>
                    </div>
                    <div className="status-bar-track">
                      <div className={`status-bar-fill ${item.status.toLowerCase()}`} style={{ width: `${item.amount ? Math.max(7, item.amount / largestStatus * 100) : 0}%` }} />
                    </div>
                    <strong>{peso(item.amount)}</strong>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="chart-panel insights-panel">
            <div className="chart-heading">
              <div><div className="eyebrow">EVENTS</div><h2>Catering events by month</h2></div>
              <span className="chart-period">{year} · by event date</span>
            </div>
            <div className="event-chart" role="img" aria-label={`Events per month in ${year}`}>
              {eventMonths.map(item => (
                <div className="event-col" key={item.label}>
                  <div className="event-track">
                    <div className="event-fill" style={{ height: `${item.count ? Math.max(10, (item.count / largestEvents) * 100) : 0}%` }} />
                  </div>
                  <strong>{item.label}</strong>
                  <small>{item.count || "—"}</small>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="chart-panel insights-panel">
          <div className="chart-heading">
            <div><div className="eyebrow">TOP CLIENTS</div><h2>Highest billed accounts</h2></div>
            <span className="chart-period">Up to 8 · {year}</span>
          </div>
          <div className="client-rank">
            {topClients.map((item, index) => (
              <div className="client-rank-row" key={item.id}>
                <span className="rank-index">{index + 1}</span>
                <div className="rank-copy">
                  {item.id === "unassigned" ? <strong>{item.name}</strong> : <Link href={`/clients/${item.id}?year=${year}`} className="client-name-link">{item.name}</Link>}
                  <small>{item.deals} {item.deals === 1 ? "deal" : "deals"} · Outstanding {peso(item.due)}</small>
                </div>
                <div className="rank-bar-wrap">
                  <div className="rank-bar" style={{ width: `${Math.max(6, (item.billed / largestClient) * 100)}%` }} />
                </div>
                <strong className="rank-amount">{peso(item.billed)}</strong>
              </div>
            ))}
          </div>
          <p className="insights-note">Includes unassigned dated SOAs. Clients with no dated SOAs in {year} are hidden.</p>
        </section>
      </>
    )}
  </div></AppShell>;
}
