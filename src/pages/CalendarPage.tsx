import { useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { CalendarDays, ChevronLeft, ChevronRight, FileUp, Plus, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { LedgerState } from "@/components/LedgerState";
import { importWordMenu } from "@/lib/menuImport";
import { manilaToday } from "@/lib/soa";
import { errorMessage, useCateringEvents, useClients, type CateringEvent } from "@/lib/tracker";

const monthLabel = (year: number, month: number) =>
  new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const isoDate = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const weekdayLong = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
const dateLong = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

function eventTitle(event: CateringEvent) {
  return event.name?.trim() || "Catering event";
}

function mealPreview(day: CateringEvent["days"][number] | undefined) {
  if (!day) return "No menu for this date";
  const parts = [
    day.breakfast && `B: ${day.breakfast.split("\n")[0]}`,
    day.amSnacks && `AM: ${day.amSnacks.split("\n")[0]}`,
    day.lunch && `L: ${day.lunch.split("\n")[0]}`,
    day.pmSnacks && `PM: ${day.pmSnacks.split("\n")[0]}`,
    day.dinner && `D: ${day.dinner.split("\n")[0]}`,
  ].filter(Boolean);
  return parts.slice(0, 2).join(" · ") || "Menu saved";
}

export default function CalendarPage() {
  const clientsQuery = useClients();
  const eventsQuery = useCateringEvents();
  const [, setLocation] = useLocation();
  const today = manilaToday();
  const fileRef = useRef<HTMLInputElement>(null);
  const [monthCursor, setMonthCursor] = useState(() => {
    const date = new Date(`${today}T12:00:00`);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [year, month] = [monthCursor.year, monthCursor.month];

  const days = useMemo(() => {
    const offset = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: total }, (_, index) => index + 1)];
  }, [year, month]);

  if (!clientsQuery.data || !eventsQuery.data) {
    return (
      <AppShell>
        <div className="page-wrap">
          <LedgerState
            isLoading={clientsQuery.isLoading || eventsQuery.isLoading}
            error={clientsQuery.error ?? eventsQuery.error}
          />
        </div>
      </AppShell>
    );
  }

  const clients = clientsQuery.data;
  const events = eventsQuery.data;
  const clientName = (id: string | null) =>
    id ? (clients.find(client => client.id === id)?.name?.trim() || "Unnamed agency") : "Unassigned";

  const eventsOnDate = (iso: string) =>
    events
      .filter(event => event.days.some(day => day.eventDate === iso))
      .sort((a, b) => eventTitle(a).localeCompare(eventTitle(b)));

  const monthEventCount = events.filter(event =>
    event.days.some(day => day.eventDate.startsWith(`${year}-${String(month + 1).padStart(2, "0")}-`)),
  ).length;

  const selectedEvents = eventsOnDate(selectedDate);

  const moveMonth = (amount: number) => {
    const next = new Date(year, month + amount, 1);
    setMonthCursor({ year: next.getFullYear(), month: next.getMonth() });
  };

  const goToday = () => {
    const date = new Date(`${today}T12:00:00`);
    setMonthCursor({ year: date.getFullYear(), month: date.getMonth() });
    setSelectedDate(today);
  };

  const importAndCreate = async (file: File | null) => {
    if (!file) return;
    try {
      const result = await importWordMenu(file);
      const payload = {
        name: result.rows[0] && result.rows[result.rows.length - 1]
          ? `Menu ${result.rows[0].eventDate} to ${result.rows[result.rows.length - 1].eventDate}`
          : "Imported menu",
        notes: result.notes,
        rows: result.rows,
      };
      sessionStorage.setItem("caterledger.menuImport", JSON.stringify(payload));
      toast.success(`Loaded ${result.rows.length} days — review and save`);
      setLocation("/calendar/events/new?import=1");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : errorMessage(error));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <AppShell>
      <div className="page-wrap calendar-page calendar-split-page">
        <div className="page-heading calendar-heading">
          <div>
            <div className="eyebrow">CATERING EVENTS</div>
            <h1>Calendar</h1>
            <p>Plan menus by day. Billing stays on Statements of Account.</p>
          </div>
        </div>

        <div className="calendar-split">
          <section className="calendar-main-pane">
            <div className="calendar-toolbar">
              <div className="calendar-month-nav">
                <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => moveMonth(-1)}>
                  <ChevronLeft size={18} />
                </Button>
                <Button variant="outline" onClick={goToday}>Today</Button>
                <Button variant="outline" size="icon" aria-label="Next month" onClick={() => moveMonth(1)}>
                  <ChevronRight size={18} />
                </Button>
                <strong>{monthLabel(year, month)}</strong>
                <span className="calendar-count">{monthEventCount} {monthEventCount === 1 ? "event" : "events"}</span>
              </div>
              <div className="calendar-toolbar-actions">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="sr-only"
                  onChange={event => { void importAndCreate(event.target.files?.[0] ?? null); }}
                />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <FileUp size={16} />Import Word Menu
                </Button>
                <Button className="add-button" onClick={() => setLocation("/calendar/events/new")}>
                  <Plus size={16} />Add Catering Event
                </Button>
              </div>
            </div>

            <div className="calendar-panel">
              <div className="calendar-weekdays">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <div key={day}>{day}</div>)}
              </div>
              <div className="calendar-grid">
                {days.map((day, index) => {
                  if (!day) return <div key={`blank-${index}`} className="calendar-day outside-day" />;
                  const dayString = isoDate(year, month, day);
                  const dayEvents = eventsOnDate(dayString);
                  const shown = dayEvents.slice(0, 2);
                  const more = dayEvents.length - shown.length;
                  return (
                    <button
                      type="button"
                      key={dayString}
                      className={`calendar-day calendar-day-button ${dayString === today ? "today" : ""} ${dayString === selectedDate ? "selected-day" : ""}`}
                      onClick={() => setSelectedDate(dayString)}
                    >
                      <span className="calendar-day-number">{day}</span>
                      {shown.map(event => (
                        <span key={event.id} className="calendar-event-pill">{eventTitle(event)}</span>
                      ))}
                      {more > 0 && <span className="calendar-more">+{more} more</span>}
                    </button>
                  );
                })}
              </div>
              <div className="calendar-legend">
                <span><i className="legend-today" />Today</span>
                <span><i className="legend-selected" />Selected</span>
                <span><i className="legend-event" />Event</span>
              </div>
            </div>
          </section>

          <aside className="calendar-day-pane">
            <div className="day-pane-header">
              <div>
                <div className="eyebrow">{weekdayLong(selectedDate).toUpperCase()}</div>
                <h2>{dateLong(selectedDate)}</h2>
                <p>{selectedEvents.length} {selectedEvents.length === 1 ? "event" : "events"}</p>
              </div>
              {selectedDate !== today && (
                <button type="button" className="text-link" onClick={goToday}>Back to today</button>
              )}
            </div>

            {selectedEvents.length ? (
              <div className="day-event-list">
                {selectedEvents.map(event => {
                  const dayMenu = event.days.find(day => day.eventDate === selectedDate);
                  return (
                    <Link
                      key={event.id}
                      href={`/calendar/events/${event.id}?date=${encodeURIComponent(selectedDate)}`}
                      className="day-event-card"
                    >
                      <span className="day-event-icon"><UtensilsCrossed size={16} /></span>
                      <div className="day-event-copy">
                        <strong>{eventTitle(event)}</strong>
                        <span>{clientName(event.clientId)}</span>
                        <small>{mealPreview(dayMenu)}</small>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state compact-empty">
                <span className="empty-icon"><CalendarDays size={19} /></span>
                <h3>No events this day</h3>
                <p>Add a catering event or import a Word menu.</p>
                <Button variant="outline" onClick={() => setLocation(`/calendar/events/new?date=${encodeURIComponent(selectedDate)}`)}>
                  <Plus size={15} />Add Catering Event
                </Button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
