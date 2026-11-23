import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LedgerState } from "@/components/LedgerState";
import { currentManilaYear, peso } from "@/lib/soa";
import { useClients, useSoas } from "@/lib/tracker";

function displayName(value: string | null | undefined) {
  return value?.trim() || "Unnamed agency";
}

function shareOf(part: number, whole: number) {
  if (whole <= 0 || part <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
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
  const totalBilled = yearly.reduce((sum, record) => sum + (record.amount ?? 0), 0);
  const outstanding = yearly.filter(record => record.status !== "Paid").reduce((sum, record) => sum + (record.amount ?? 0), 0);

  const clientRows = [...clients.map(client => {
    const records = yearly.filter(record => record.clientId === client.id);
    const billed = records.reduce((sum, record) => sum + (record.amount ?? 0), 0);
    const due = records.filter(record => record.status !== "Paid").reduce((sum, record) => sum + (record.amount ?? 0), 0);
    const paid = records.filter(record => record.status === "Paid").reduce((sum, record) => sum + (record.amount ?? 0), 0);
    return {
      id: client.id,
      name: displayName(client.name),
      deals: records.length,
      billed,
      due,
      paid,
      share: shareOf(billed, totalBilled),
    };
  }), (() => {
    const records = yearly.filter(record => !record.clientId);
    const billed = records.reduce((sum, record) => sum + (record.amount ?? 0), 0);
    const due = records.filter(record => record.status !== "Paid").reduce((sum, record) => sum + (record.amount ?? 0), 0);
    const paid = records.filter(record => record.status === "Paid").reduce((sum, record) => sum + (record.amount ?? 0), 0);
    return {
      id: "unassigned",
      name: "Unassigned",
      deals: records.length,
      billed,
      due,
      paid,
      share: shareOf(billed, totalBilled),
    };
  })()].filter(row => row.deals > 0);

  const byBilled = [...clientRows].sort((a, b) => b.billed - a.billed);
  const byDue = [...clientRows].filter(row => row.due > 0).sort((a, b) => b.due - a.due);
  const byDeals = [...clientRows].sort((a, b) => b.deals - a.deals || b.billed - a.billed);
  const topContributor = byBilled[0];
  const topOwing = byDue[0];
  const mostDeals = byDeals[0];
  const largestBilled = Math.max(1, ...byBilled.map(item => item.billed));
  const largestDue = Math.max(1, ...byDue.map(item => item.due));

  const statusTotals = (["Paid", "Unpaid", "Overdue"] as const).map(status => ({
    status,
    amount: yearly.filter(record => record.status === status).reduce((sum, record) => sum + (record.amount ?? 0), 0),
    count: yearly.filter(record => record.status === status).length,
  }));
  const largestStatus = Math.max(1, ...statusTotals.map(item => item.amount));

  const topShareTotal = byBilled.slice(0, 5).reduce((sum, row) => sum + row.share, 0);

  return <AppShell><div className="page-wrap insights-page">
    <div className="page-heading dashboard-heading">
      <div>
        <div className="eyebrow">AGENCY INSIGHTS</div>
        <h1>Who contributes the most.</h1>
        <p>See which agencies drive billing, who still owes, and each account’s share of the year.</p>
      </div>
      <label className="year-picker">
        <span>YEAR</span>
        <strong>{year}</strong>
        <select aria-label="Insights year" value={year} onChange={event => setYear(Number(event.target.value))}>
          {years.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <ChevronDown size={15} />
      </label>
    </div>

    {!yearly.length ? (
      <div className="empty-state table-panel">
        <h3>No dated SOAs for {year}</h3>
        <p>Add statements with an SOA date to compare agency contributions.</p>
        <Link href="/soa/new" className="text-link">Add an SOA →</Link>
      </div>
    ) : (
      <>
        <section className="contributor-highlights" aria-label={`Top agency highlights for ${year}`}>
          <article className="highlight-card lead-card">
            <div className="eyebrow">BIGGEST CONTRIBUTOR</div>
            {topContributor?.id === "unassigned" ? <h2>{topContributor.name}</h2> : <h2><Link href={`/clients/${topContributor!.id}?year=${year}`}>{topContributor!.name}</Link></h2>}
            <strong>{peso(topContributor!.billed)}</strong>
            <small>{topContributor!.share}% of total billed · {topContributor!.deals} {topContributor!.deals === 1 ? "deal" : "deals"}</small>
          </article>
          <article className="highlight-card">
            <div className="eyebrow">MOST OUTSTANDING</div>
            {topOwing ? (
              <>
                {topOwing.id === "unassigned" ? <h2>{topOwing.name}</h2> : <h2><Link href={`/clients/${topOwing.id}?year=${year}`}>{topOwing.name}</Link></h2>}
                <strong>{peso(topOwing.due)}</strong>
                <small>{shareOf(topOwing.due, outstanding)}% of outstanding balance</small>
              </>
            ) : (
              <>
                <h2>All clear</h2>
                <strong>{peso(0)}</strong>
                <small>No unpaid or overdue amounts</small>
              </>
            )}
          </article>
          <article className="highlight-card">
            <div className="eyebrow">MOST DEALS</div>
            {mostDeals?.id === "unassigned" ? <h2>{mostDeals.name}</h2> : <h2><Link href={`/clients/${mostDeals!.id}?year=${year}`}>{mostDeals!.name}</Link></h2>}
            <strong>{mostDeals!.deals}</strong>
            <small>{peso(mostDeals!.billed)} billed in {year}</small>
          </article>
        </section>

        <section className="chart-panel insights-panel">
          <div className="chart-heading">
            <div><div className="eyebrow">SHARE OF BILLING</div><h2>Agency contribution</h2></div>
            <span className="chart-period">{year} · {peso(totalBilled)} total</span>
          </div>
          <div className="share-strip" aria-hidden={byBilled.length === 0}>
            {byBilled.map((item, index) => (
              <div
                key={item.id}
                className={`share-segment tone-${index % 6}`}
                style={{ width: `${Math.max(item.share, item.billed > 0 ? 1.5 : 0)}%` }}
                title={`${item.name}: ${item.share}%`}
              />
            ))}
          </div>
          <div className="client-rank contribution-rank">
            {byBilled.map((item, index) => (
              <div className="client-rank-row contribution-row" key={item.id}>
                <span className="rank-index">{index + 1}</span>
                <div className="rank-copy">
                  {item.id === "unassigned" ? <strong>{item.name}</strong> : <Link href={`/clients/${item.id}?year=${year}`} className="client-name-link">{item.name}</Link>}
                  <small>{item.deals} {item.deals === 1 ? "deal" : "deals"} · Paid {peso(item.paid)} · Outstanding {peso(item.due)}</small>
                </div>
                <div className="rank-bar-wrap">
                  <div className="rank-bar" style={{ width: `${Math.max(6, (item.billed / largestBilled) * 100)}%` }} />
                </div>
                <div className="rank-metrics">
                  <strong>{peso(item.billed)}</strong>
                  <span>{item.share}%</span>
                </div>
              </div>
            ))}
          </div>
          <p className="insights-note">
            Top 5 agencies make up {Math.min(100, Math.round(topShareTotal * 10) / 10)}% of billed amount in {year}.
            Unassigned dated SOAs are included when present.
          </p>
        </section>

        <div className="insights-split">
          <section className="chart-panel insights-panel">
            <div className="chart-heading">
              <div><div className="eyebrow">WHO STILL OWES</div><h2>Largest outstanding balances</h2></div>
              <span className="chart-period">{peso(outstanding)} open</span>
            </div>
            {byDue.length ? (
              <div className="client-rank">
                {byDue.slice(0, 8).map((item, index) => (
                  <div className="client-rank-row" key={item.id}>
                    <span className="rank-index owing-index">{index + 1}</span>
                    <div className="rank-copy">
                      {item.id === "unassigned" ? <strong>{item.name}</strong> : <Link href={`/clients/${item.id}?year=${year}`} className="client-name-link">{item.name}</Link>}
                      <small>{shareOf(item.due, outstanding)}% of outstanding</small>
                    </div>
                    <div className="rank-bar-wrap">
                      <div className="rank-bar owing-bar" style={{ width: `${Math.max(6, (item.due / largestDue) * 100)}%` }} />
                    </div>
                    <strong className="rank-amount">{peso(item.due)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state compact-empty"><h3>Nothing outstanding</h3><p>All dated SOAs for {year} are paid.</p></div>
            )}
          </section>

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
        </div>
      </>
    )}
  </div></AppShell>;
}
