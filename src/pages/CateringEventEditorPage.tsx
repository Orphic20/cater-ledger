import { FormEvent, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CircleAlert, FileUp, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { LedgerState } from "@/components/LedgerState";
import {
  blankMenuDay,
  importWordMenu,
  revalidateRows,
  validateImportRows,
  type ImportedMenuRow,
} from "@/lib/menuImport";
import {
  errorMessage,
  useCateringEvents,
  useClients,
  useDeleteCateringEvent,
  useSaveCateringEvent,
  type CateringDayMenu,
} from "@/lib/tracker";

function toRows(days: CateringDayMenu[]): ImportedMenuRow[] {
  return days.map(day => ({
    ...blankMenuDay(day.eventDate),
    eventDate: day.eventDate,
    rawDate: day.eventDate,
    breakfast: day.breakfast,
    amSnacks: day.amSnacks,
    lunch: day.lunch,
    pmSnacks: day.pmSnacks,
    dinner: day.dinner,
    issues: day.eventDate ? [] : ["Missing date"],
  }));
}

export default function CateringEventEditorPage({ eventId }: { eventId: string | null }) {
  const clientsQuery = useClients();
  const eventsQuery = useCateringEvents();
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

  const existing = eventId ? eventsQuery.data.find(item => item.id === eventId) : undefined;
  if (eventId && !existing) {
    return (
      <AppShell>
        <div className="page-wrap">
          <div className="empty-state">
            <h2>Event not found</h2>
            <p>That catering event isn’t in your ledger.</p>
            <Link href="/calendar" className="text-link">Back to Calendar</Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const params = new URLSearchParams(window.location.search);
  const focusDate = params.get("date") || "";
  let importedName = "";
  let importedNotes = "";
  let importedRows: ImportedMenuRow[] | null = null;
  if (!existing && params.get("import") === "1") {
    try {
      const raw = sessionStorage.getItem("caterledger.menuImport");
      if (raw) {
        const payload = JSON.parse(raw) as { name?: string; notes?: string; rows?: ImportedMenuRow[] };
        importedName = payload.name ?? "";
        importedNotes = payload.notes ?? "";
        importedRows = payload.rows ?? null;
        sessionStorage.removeItem("caterledger.menuImport");
      }
    } catch {
      /* ignore bad payload */
    }
  }

  const seedDays = existing?.days
    ?? (importedRows
      ? importedRows
      : focusDate
        ? [{ eventDate: focusDate, breakfast: "", amSnacks: "", lunch: "", pmSnacks: "", dinner: "" }]
        : []);

  return (
    <EventForm
      key={existing?.id ?? (importedRows ? "import" : "new")}
      existingId={existing?.id}
      initialName={existing?.name ?? importedName}
      initialClientId={existing?.clientId ?? "unassigned"}
      initialNotes={existing?.notes ?? importedNotes}
      initialRows={importedRows ?? toRows(seedDays)}
      clients={clientsQuery.data}
    />
  );
}

function EventForm({
  existingId,
  initialName,
  initialClientId,
  initialNotes,
  initialRows,
  clients,
}: {
  existingId?: string;
  initialName: string;
  initialClientId: string;
  initialNotes: string;
  initialRows: ImportedMenuRow[];
  clients: { id: string; name: string | null }[];
}) {
  const saveEvent = useSaveCateringEvent();
  const deleteEvent = useDeleteCateringEvent();
  const [, setLocation] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [clientId, setClientId] = useState(initialClientId);
  const [notes, setNotes] = useState(initialNotes);
  const [rows, setRows] = useState<ImportedMenuRow[]>(() => revalidateRows(initialRows.length ? initialRows : [blankMenuDay()]));
  const [importing, setImporting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const focusDate = new URLSearchParams(window.location.search).get("date") || "";

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => (a.eventDate || a.rawDate).localeCompare(b.eventDate || b.rawDate)),
    [rows],
  );
  const canSave = validateImportRows(rows);

  const updateRow = (index: number, patch: Partial<ImportedMenuRow>) => {
    setRows(current => {
      const next = current.map((row, i) => (i === index ? { ...row, ...patch } : row));
      return revalidateRows(next);
    });
  };

  const onImport = async (file: File | null) => {
    if (!file) return;
    setImporting(true);
    try {
      const result = await importWordMenu(file);
      setRows(revalidateRows(result.rows));
      if (result.notes) setNotes(result.notes);
      if (!name.trim()) {
        const first = result.rows[0]?.eventDate;
        const last = result.rows[result.rows.length - 1]?.eventDate;
        if (first && last) setName(`Menu ${first} to ${last}`);
      }
      toast.success(`Imported ${result.rows.length} menu ${result.rows.length === 1 ? "day" : "days"}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) {
      toast.error("Fix missing, invalid, or duplicate dates before saving.");
      return;
    }
    try {
      await saveEvent.mutateAsync({
        id: existingId,
        clientId: clientId === "unassigned" ? null : clientId,
        name,
        notes,
        days: rows.map(row => ({
          eventDate: row.eventDate,
          breakfast: row.breakfast,
          amSnacks: row.amSnacks,
          lunch: row.lunch,
          pmSnacks: row.pmSnacks,
          dinner: row.dinner,
        })),
      });
      toast.success(existingId ? "Catering event updated" : "Catering event saved");
      const backDate = focusDate || rows.map(row => row.eventDate).filter(Boolean).sort()[0] || "";
      setLocation(backDate ? `/calendar?date=${encodeURIComponent(backDate)}` : "/calendar");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const confirmDelete = async () => {
    if (!existingId) return;
    try {
      await deleteEvent.mutateAsync(existingId);
      toast.success("Catering event deleted");
      setLocation("/calendar");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <AppShell>
      <div className="page-wrap editor-page catering-event-editor">
        <Link href={focusDate ? `/calendar?date=${encodeURIComponent(focusDate)}` : "/calendar"} className="back-link"><ArrowLeft size={16} />Back to Calendar</Link>
        <div className="page-heading editor-heading">
          <div>
            <div className="eyebrow">{existingId ? "CATERING EVENT" : "NEW CATERING EVENT"}</div>
            <h1>{existingId ? (name.trim() || "Untitled event") : "Add a Catering Event"}</h1>
            <p>Menus stay with the booking. Billing stays on SOAs until you create one.</p>
          </div>
          {existingId && (
            <Button
              className="add-button"
              onClick={() => {
                const query = new URLSearchParams({ eventId: existingId });
                if (clientId !== "unassigned") query.set("clientId", clientId);
                setLocation(`/soa/new?${query.toString()}`);
              }}
            >
              Create SOA
            </Button>
          )}
        </div>

        <form className="editor-card" onSubmit={onSave}>
          <section className="form-section">
            <div className="form-section-title">
              <span className="form-step">1</span>
              <div><h2>Event details</h2><p>Agency, name, and notes for the whole booking.</p></div>
            </div>
            <div className="form-grid">
              <label className="form-field">
                <span>Event name <i>Optional</i></span>
                <input value={name} onChange={event => setName(event.target.value)} placeholder="e.g. December training menu" />
              </label>
              <label className="form-field">
                <span>Agency <i>Optional</i></span>
                <div className="select-wrap">
                  <select value={clientId} onChange={event => setClientId(event.target.value)}>
                    <option value="unassigned">Unassigned</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name?.trim() || "Unnamed agency"}</option>
                    ))}
                  </select>
                </div>
              </label>
            </div>
            <label className="form-field">
              <span>Notes <i>Optional</i></span>
              <textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} placeholder="Buffet notes, free-flowing coffee, etc." />
            </label>
          </section>

          <section className="form-section catering-section">
            <div className="form-section-title">
              <span className="form-step event-step">2</span>
              <div>
                <h2>{focusDate ? "Menu for this day" : "Daily menus"}</h2>
                <p>{focusDate ? "Only this date is shown. The other days in the booking stay as they are." : "One menu per event date. Import a Word menu or enter days manually."}</p>
              </div>
            </div>
            {!focusDate && <div className="menu-toolbar">
              <input
                ref={fileRef}
                type="file"
                accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                onChange={event => { void onImport(event.target.files?.[0] ?? null); }}
              />
              <Button type="button" variant="outline" disabled={importing} onClick={() => fileRef.current?.click()}>
                <FileUp size={16} />{importing ? "Importing…" : "Import Word Menu"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setRows(current => revalidateRows([...current, blankMenuDay()]))}>
                <Plus size={16} />Add day
              </Button>
            </div>}

            <div className="menu-day-list">
              {(focusDate ? sortedRows.filter(row => row.eventDate === focusDate) : sortedRows).map((row) => {
                const index = rows.indexOf(row);
                const focused = Boolean(focusDate);
                return (
                  <article key={`${row.eventDate}-${index}`} className={`menu-day-card ${focused ? "menu-day-focused" : ""} ${row.issues.length ? "menu-day-invalid" : ""}`}>
                    <div className="menu-day-heading">
                      <label className="form-field">
                        <span>Event date</span>
                        <input
                          type="date"
                          value={row.eventDate}
                          readOnly={Boolean(focusDate)}
                          onChange={event => updateRow(index, { eventDate: event.target.value, rawDate: event.target.value })}
                        />
                      </label>
                      {!focusDate && (
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Remove day"
                          onClick={() => setRows(current => revalidateRows(current.filter((_, i) => i !== index)))}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                    {row.issues.length > 0 && (
                      <div className="menu-day-issues"><CircleAlert size={14} />{row.issues.join(" · ")}</div>
                    )}
                    <div className="menu-meal-grid">
                      {([
                        ["breakfast", "Breakfast"],
                        ["amSnacks", "AM Snacks"],
                        ["lunch", "Lunch"],
                        ["pmSnacks", "PM Snacks"],
                        ["dinner", "Dinner"],
                      ] as const).map(([key, label]) => (
                        <label className="form-field" key={key}>
                          <span>{label}</span>
                          <textarea
                            rows={4}
                            value={row[key]}
                            onChange={event => updateRow(index, { [key]: event.target.value })}
                            placeholder="Leave blank if none"
                          />
                        </label>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {showDelete && existingId && (
            <div className="confirm-payment confirm-delete">
              <CircleAlert size={20} />
              <div className="confirm-copy">
                <strong>Delete this catering event?</strong>
                <p>Linked SOAs stay in the ledger but become unlinked from this event.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
              <Button type="button" className="delete-action" disabled={deleteEvent.isPending} onClick={() => { void confirmDelete(); }}>Delete event</Button>
            </div>
          )}

          <div className="form-footer">
            <div className="form-footer-note">
              {focusDate
                ? "Saving keeps the other days in this booking."
                : canSave
                  ? `${rows.length} ${rows.length === 1 ? "day" : "days"} ready to save.`
                  : "Fix date issues in the preview before saving."}
            </div>
            <div className="footer-actions">
              {existingId && (
                <Button type="button" variant="outline" className="delete-outline" onClick={() => setShowDelete(true)}>
                  <Trash2 size={15} />Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setLocation("/calendar")}>Cancel</Button>
              <Button type="submit" className="save-button" disabled={!canSave || saveEvent.isPending}>
                <Save size={16} />Save event
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
