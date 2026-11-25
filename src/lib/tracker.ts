import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { statusFor, type SoaStatus } from "@/lib/soa";
import { supabase } from "@/lib/supabase";

export type Client = {
  id: string;
  name: string | null;
  contactName: string | null;
  contactNumber: string | null;
};

export type CateringDayMenu = {
  id?: string;
  eventDate: string;
  breakfast: string;
  amSnacks: string;
  lunch: string;
  pmSnacks: string;
  dinner: string;
};

export type CateringEvent = {
  id: string;
  clientId: string | null;
  name: string | null;
  notes: string | null;
  days: CateringDayMenu[];
};

export type CateringEventDraft = {
  id?: string;
  clientId: string | null;
  name: string;
  notes: string;
  days: CateringDayMenu[];
};

export type ViewSoa = {
  id: string;
  clientId: string | null;
  refNumber: string | null;
  agency: string | null;
  date: string | null;
  dueDate: string | null;
  amount: number | null;
  paidAt: string | null;
  eventName: string | null;
  eventDate: string | null;
  eventEndDate: string | null;
  venue: string | null;
  cateringEventId: string | null;
  status: SoaStatus;
};

export type RefMode = "automatic" | "manual" | "blank";
export type SoaDraft = {
  id?: string;
  clientId: string | null;
  newClient?: { name: string; contactName: string; contactNumber: string };
  refMode: RefMode;
  refNumber: string | null;
  agency: string | null;
  date: string | null;
  dueDate: string | null;
  amount: number | null;
  cateringEventId: string | null;
};

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asAmount(value: number | string | null): number | null {
  if (value == null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") return error.message;
  return "Something went wrong.";
}

export function isDuplicateReference(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

function throwIfError(error: { message: string; code?: string } | null): void {
  if (!error) return;
  const wrapped = new Error(error.message) as Error & { code?: string };
  wrapped.code = error.code;
  throw wrapped;
}

function mapClient(row: {
  id: string;
  name: string | null;
  contact_name: string | null;
  contact_number: string | null;
}): Client {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    contactNumber: row.contact_number,
  };
}

function mapSoa(row: {
  id: string;
  client_id: string | null;
  ref_no: string | null;
  agency: string | null;
  soa_date: string | null;
  due_date: string | null;
  amount: number | string | null;
  paid_at: string | null;
  event_name: string | null;
  event_date: string | null;
  event_end_date?: string | null;
  venue: string | null;
  catering_event_id?: string | null;
  status?: SoaStatus | null;
}): ViewSoa {
  const paidAt = row.paid_at;
  const dueDate = row.due_date;
  return {
    id: row.id,
    clientId: row.client_id,
    refNumber: row.ref_no,
    agency: row.agency,
    date: row.soa_date,
    dueDate,
    amount: asAmount(row.amount),
    paidAt,
    eventName: row.event_name,
    eventDate: row.event_date,
    eventEndDate: row.event_end_date ?? null,
    venue: row.venue,
    cateringEventId: row.catering_event_id ?? null,
    status: row.status ?? statusFor(paidAt, dueDate),
  };
}

function mapDay(row: {
  id: string;
  event_date: string;
  breakfast: string | null;
  am_snacks: string | null;
  lunch: string | null;
  pm_snacks: string | null;
  dinner: string | null;
}): CateringDayMenu {
  return {
    id: row.id,
    eventDate: row.event_date,
    breakfast: row.breakfast ?? "",
    amSnacks: row.am_snacks ?? "",
    lunch: row.lunch ?? "",
    pmSnacks: row.pm_snacks ?? "",
    dinner: row.dinner ?? "",
  };
}

async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, contact_name, contact_number")
    .order("name", { ascending: true, nullsFirst: false });
  throwIfError(error);
  return (data ?? []).map(mapClient);
}

async function fetchSoas(): Promise<ViewSoa[]> {
  const { data, error } = await supabase
    .from("soa_tracker")
    .select("id, client_id, ref_no, agency, soa_date, due_date, amount, paid_at, event_name, event_date, event_end_date, venue, catering_event_id, status")
    .order("soa_date", { ascending: false, nullsFirst: false });
  throwIfError(error);
  return (data ?? []).map(mapSoa);
}

async function fetchCateringEvents(): Promise<CateringEvent[]> {
  const { data: events, error } = await supabase
    .from("catering_events")
    .select("id, client_id, name, notes, created_at")
    .order("created_at", { ascending: false });
  throwIfError(error);
  if (!events?.length) return [];

  const { data: days, error: daysError } = await supabase
    .from("catering_event_days")
    .select("id, event_id, event_date, breakfast, am_snacks, lunch, pm_snacks, dinner")
    .order("event_date", { ascending: true });
  throwIfError(daysError);

  const daysByEvent = new Map<string, CateringDayMenu[]>();
  for (const day of days ?? []) {
    const list = daysByEvent.get(day.event_id) ?? [];
    list.push(mapDay(day));
    daysByEvent.set(day.event_id, list);
  }

  return events.map(event => ({
    id: event.id,
    clientId: event.client_id,
    name: event.name,
    notes: event.notes,
    days: daysByEvent.get(event.id) ?? [],
  }));
}

export function useClients() {
  return useQuery({ queryKey: ["clients"], queryFn: fetchClients });
}

export function useSoas() {
  return useQuery({ queryKey: ["soas"], queryFn: fetchSoas });
}

export function useCateringEvents() {
  return useQuery({ queryKey: ["catering-events"], queryFn: fetchCateringEvents });
}

async function ensureClientId(draft: SoaDraft): Promise<string | null> {
  if (!draft.newClient) return draft.clientId;
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: blankToNull(draft.newClient.name),
      contact_name: blankToNull(draft.newClient.contactName),
      contact_number: blankToNull(draft.newClient.contactNumber),
    })
    .select("id")
    .single();
  throwIfError(error);
  if (!data) throw new Error("Couldn’t create the agency.");
  return data.id;
}

async function saveSoa(draft: SoaDraft): Promise<string> {
  const clientId = await ensureClientId(draft);

  if (draft.id) {
    const { error } = await supabase
      .from("soas")
      .update({
        client_id: clientId,
        ref_no: draft.refNumber,
        agency: draft.agency,
        soa_date: draft.date,
        due_date: draft.dueDate,
        amount: draft.amount,
        catering_event_id: draft.cateringEventId,
      })
      .eq("id", draft.id);
    throwIfError(error);
    return draft.id;
  }

  const { data, error } = await supabase.rpc("create_soa", {
    p_ref_mode: draft.refMode,
    p_ref_no: draft.refMode === "manual" ? draft.refNumber : null,
    p_client_id: clientId,
    p_agency: draft.agency,
    p_soa_date: draft.date,
    p_due_date: draft.dueDate,
    p_amount: draft.amount,
    p_event_name: null,
    p_event_date: null,
    p_venue: null,
  });
  throwIfError(error);
  if (!data) throw new Error("Couldn’t save the SOA.");

  if (draft.cateringEventId) {
    const { error: linkError } = await supabase
      .from("soas")
      .update({ catering_event_id: draft.cateringEventId })
      .eq("id", data.id);
    throwIfError(linkError);
  }

  return data.id;
}

async function saveCateringEvent(draft: CateringEventDraft): Promise<string> {
  const payload = {
    client_id: draft.clientId,
    name: blankToNull(draft.name),
    notes: blankToNull(draft.notes),
    updated_at: new Date().toISOString(),
  };

  let eventId = draft.id;
  if (eventId) {
    const { error } = await supabase.from("catering_events").update(payload).eq("id", eventId);
    throwIfError(error);
    const { error: deleteError } = await supabase.from("catering_event_days").delete().eq("event_id", eventId);
    throwIfError(deleteError);
  } else {
    const { data, error } = await supabase.from("catering_events").insert(payload).select("id").single();
    throwIfError(error);
    if (!data) throw new Error("Couldn’t save the catering event.");
    eventId = data.id;
  }

  const dayRows = draft.days
    .filter(day => day.eventDate)
    .map(day => ({
      event_id: eventId!,
      event_date: day.eventDate,
      breakfast: blankToNull(day.breakfast),
      am_snacks: blankToNull(day.amSnacks),
      lunch: blankToNull(day.lunch),
      pm_snacks: blankToNull(day.pmSnacks),
      dinner: blankToNull(day.dinner),
    }));

  if (dayRows.length) {
    const { error: daysError } = await supabase.from("catering_event_days").insert(dayRows);
    throwIfError(daysError);
  }

  return eventId!;
}

export function useSaveSoa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveSoa,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["soas"] });
    },
  });
}

export function useSaveCateringEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveCateringEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["catering-events"] });
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useDeleteCateringEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catering_events").delete().eq("id", id);
      throwIfError(error);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["catering-events"] });
      await queryClient.invalidateQueries({ queryKey: ["soas"] });
    },
  });
}

export function useSaveClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      contactName,
      contactNumber,
    }: {
      id: string;
      name: string;
      contactName: string;
      contactNumber: string;
    }) => {
      const { error } = await supabase
        .from("clients")
        .update({
          name: blankToNull(name),
          contact_name: blankToNull(contactName),
          contact_number: blankToNull(contactNumber),
        })
        .eq("id", id);
      throwIfError(error);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useSetPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await supabase
        .from("soas")
        .update({ paid_at: paid ? new Date().toISOString() : null })
        .eq("id", id);
      throwIfError(error);
    },
    onMutate: async ({ id, paid }) => {
      await queryClient.cancelQueries({ queryKey: ["soas"] });
      const previous = queryClient.getQueryData<ViewSoa[]>(["soas"]);
      const paidAt = paid ? new Date().toISOString() : null;
      queryClient.setQueryData<ViewSoa[]>(["soas"], current =>
        current?.map(row => (row.id === id ? { ...row, paidAt, status: statusFor(paidAt, row.dueDate) } : row)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(["soas"], context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["soas"] });
    },
  });
}

export function useDeleteSoa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("soas").delete().eq("id", id);
      throwIfError(error);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["soas"] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      throwIfError(error);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["soas"] });
    },
  });
}
