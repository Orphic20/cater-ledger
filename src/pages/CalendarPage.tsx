import { useMemo, useState } from "react";
import { Link } from "wouter";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { LedgerState } from "@/components/LedgerState";
import { manilaToday } from "@/lib/soa";
import { useClients, useSoas } from "@/lib/tracker";

const eventTitle = (value: string | null) => value?.trim() || "Catering event";
const dateText = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const monthLabel = (year: number, month: number) => new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const isoDate = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export default function CalendarPage() {
  const clientsQuery = useClients();
  const soasQuery = useSoas();
  const today = manilaToday();
  const [monthCursor, setMonthCursor] = useState(() => { const date = new Date(`${today}T12:00:00`); return { year: date.getFullYear(), month: date.getMonth() }; });
  const [year, month] = [monthCursor.year, monthCursor.month];
  const days = useMemo(() => {
    const offset = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: total }, (_, index) => index + 1)];
  }, [year, month]);
  if (!clientsQuery.data || !soasQuery.data) return <AppShell><div className="page-wrap"><LedgerState isLoading={clientsQuery.isLoading || soasQuery.isLoading} error={clientsQuery.error ?? soasQuery.error} /></div></AppShell>;
  const soas = soasQuery.data;
  const clients = clientsQuery.data;
  const clientById = (id: string | null) => clients.find(client => client.id === id);
  const monthEvents = soas.filter(record => record.eventDate?.startsWith(`${year}-${String(month + 1).padStart(2, "0")}-`)).sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""));
  const upcoming = soas.filter(record => record.eventDate && record.eventDate >= today).sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""));
  const moveMonth = (amount: number) => { const next = new Date(year, month + amount, 1); setMonthCursor({ year: next.getFullYear(), month: next.getMonth() }); };

  return <AppShell><div className="page-wrap calendar-page">
    <div className="page-heading calendar-heading"><div><div className="eyebrow">CATERING EVENTS</div><h1>Calendar</h1><p>Plan ahead for what’s on the table.</p></div><div className="calendar-month-nav"><Button variant="outline" size="icon" aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={18} /></Button><strong>{monthLabel(year, month)}</strong><Button variant="outline" size="icon" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={18} /></Button></div></div>
    <section className="calendar-panel desktop-calendar"><div className="calendar-weekdays">{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(day => <div key={day}>{day}</div>)}</div><div className="calendar-grid">{days.map((day, index) => { const dayString = day ? isoDate(year, month, day) : ""; const events = monthEvents.filter(event => event.eventDate === dayString); return <div key={`${day ?? "blank"}-${index}`} className={`calendar-day ${day ? "" : "outside-day"} ${dayString === today ? "today" : ""}`}><span className="calendar-day-number">{day ?? ""}</span>{events.map(event => <Link key={event.id} href={`/soa/${event.id}`} className="calendar-event"><strong>{eventTitle(event.eventName)}</strong><small>{clientById(event.clientId)?.name?.trim() || (event.clientId ? "Unnamed agency" : "Unassigned")}</small>{event.venue && <small className="calendar-event-venue"><MapPin size={10} />{event.venue}</small>}</Link>)}</div>; })}</div>{!monthEvents.length && <div className="calendar-empty-note">No events scheduled for this month.</div>}</section>
    <section className="upcoming-events"><div className="upcoming-header"><div><div className="eyebrow">NEXT ON THE CALENDAR</div><h2>Upcoming events</h2></div><span>{upcoming.length} {upcoming.length === 1 ? "event" : "events"}</span></div>{upcoming.length ? <div className="upcoming-list">{upcoming.map(event => <Link key={event.id} href={`/soa/${event.id}`} className="upcoming-event-card"><div className="upcoming-date"><strong>{new Date(`${event.eventDate}T12:00:00`).toLocaleDateString("en-US", { day: "2-digit" })}</strong><span>{new Date(`${event.eventDate}T12:00:00`).toLocaleDateString("en-US", { month: "short" })}</span></div><div className="upcoming-event-info"><strong>{eventTitle(event.eventName)}</strong><span>{clientById(event.clientId)?.name?.trim() || (event.clientId ? "Unnamed agency" : "Unassigned")}</span>{event.venue && <small><MapPin size={12} />{event.venue}</small>}</div><div className="upcoming-event-date">{dateText(event.eventDate!)}</div></Link>)}</div> : <div className="empty-state compact-empty"><span className="empty-icon"><CalendarDays size={19} /></span><h3>No upcoming events</h3><p>Add an Event Date to an SOA to see it here.</p><Link href="/soa/new" className="text-link">Add an SOA →</Link></div>}</section>
  </div></AppShell>;
}
