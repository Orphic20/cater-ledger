import type { CateringDayMenu } from "@/lib/tracker";

export type ImportedMenuRow = CateringDayMenu & {
  rawDate: string;
  issues: string[];
};

export type MenuImportResult = {
  rows: ImportedMenuRow[];
  notes: string;
};

const HEADER_ALIASES: Record<keyof Omit<CateringDayMenu, "id" | "eventDate"> | "date", string[]> = {
  date: ["date"],
  breakfast: ["breakfast"],
  amSnacks: ["am snacks", "am snack", "morning snacks", "a.m. snacks"],
  lunch: ["lunch"],
  pmSnacks: ["pm snacks", "pm snack", "afternoon snacks", "p.m. snacks"],
  dinner: ["dinner"],
};

function normalizeHeader(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function cellTextFromHtml(node: Element): string {
  const html = node.innerHTML
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n");
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent ?? "")
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/** Parse MM-DD-YY / MM-DD-YYYY / Day N noise from a Date cell → ISO date. */
export function parseMenuDate(raw: string): string | null {
  const text = raw.replace(/\u00a0/g, " ").trim();
  if (!text) return null;
  const match = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += year <= 69 ? 2000 : 1900;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const check = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(check.getTime()) || check.getMonth() + 1 !== month || check.getDate() !== day) return null;
  return iso;
}

function mapHeaderIndexes(cells: string[]): Partial<Record<"date" | "breakfast" | "amSnacks" | "lunch" | "pmSnacks" | "dinner", number>> | null {
  const indexes: Partial<Record<"date" | "breakfast" | "amSnacks" | "lunch" | "pmSnacks" | "dinner", number>> = {};
  cells.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    (Object.keys(HEADER_ALIASES) as Array<keyof typeof HEADER_ALIASES>).forEach(key => {
      if (HEADER_ALIASES[key].some(alias => normalized === alias || normalized.includes(alias))) {
        indexes[key as "date"] = index;
      }
    });
  });
  if (indexes.date == null || indexes.breakfast == null || indexes.lunch == null) return null;
  return indexes;
}

function isHeaderRow(cells: string[]): boolean {
  return mapHeaderIndexes(cells) != null;
}

function isBlankRow(cells: string[]): boolean {
  return cells.every(cell => !cell.replace(/\s+/g, "").trim());
}

function buildRows(tableRows: string[][], notes: string): MenuImportResult {
  let headerMap: ReturnType<typeof mapHeaderIndexes> = null;
  const rows: ImportedMenuRow[] = [];

  for (const cells of tableRows) {
    if (isBlankRow(cells)) continue;
    if (!headerMap) {
      headerMap = mapHeaderIndexes(cells);
      continue;
    }
    if (isHeaderRow(cells)) continue;

    const rawDate = (cells[headerMap.date!] ?? "").trim();
    const eventDate = parseMenuDate(rawDate);
    const pick = (key: "breakfast" | "amSnacks" | "lunch" | "pmSnacks" | "dinner") => {
      const index = headerMap![key];
      if (index == null) return "";
      return (cells[index] ?? "").trim();
    };

    const issues: string[] = [];
    if (!rawDate) issues.push("Missing date");
    else if (!eventDate) issues.push("Invalid date");

    rows.push({
      rawDate,
      eventDate: eventDate ?? "",
      breakfast: pick("breakfast"),
      amSnacks: pick("amSnacks"),
      lunch: pick("lunch"),
      pmSnacks: pick("pmSnacks"),
      dinner: pick("dinner"),
      issues,
    });
  }

  if (!headerMap) {
    throw new Error("Couldn’t find a menu table with Date, Breakfast, AM Snacks, Lunch, PM Snacks, and Dinner columns.");
  }
  if (!rows.length) {
    throw new Error("The menu table was found, but it has no date rows.");
  }

  const seen = new Map<string, number>();
  rows.forEach((row, index) => {
    if (!row.eventDate) return;
    const prior = seen.get(row.eventDate);
    if (prior != null) {
      row.issues.push("Duplicate date");
      rows[prior].issues.push("Duplicate date");
    } else {
      seen.set(row.eventDate, index);
    }
  });

  return { rows, notes };
}

function extractNotesFromText(text: string): string {
  const noteMatch = text.match(/\bNote\s*:\s*([\s\S]+?)(?:\n\s*Prepared by:|\n\s*$)/i);
  if (!noteMatch) return "";
  return noteMatch[1]
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** Split word-extractor body (tab-separated table) into cell rows. */
function parseTabularBody(body: string): { tableRows: string[][]; notes: string } {
  const lines = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const startIndex = lines.findIndex(line => {
    const normalized = normalizeHeader(line.replace(/\t/g, " "));
    return normalized.includes("date") && normalized.includes("breakfast");
  });
  if (startIndex < 0) {
    throw new Error("Couldn’t find a menu table with Date, Breakfast, AM Snacks, Lunch, PM Snacks, and Dinner columns.");
  }

  const chunk: string[] = [];
  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*Prepared by:/i.test(line)) break;
    // Stop gathering table once we hit a second sparse junk block after notes
    if (/^\s*Note\s*:/i.test(line)) {
      chunk.push(line);
      break;
    }
    chunk.push(line);
  }

  // Reconstruct rows: a new row starts when a line begins with a date pattern (or is the header).
  const tableRows: string[][] = [];
  let current: string[] | null = null;
  let currentCell = "";

  const flushCell = () => {
    if (!current) return;
    current.push(currentCell.replace(/\s+$/g, ""));
    currentCell = "";
  };
  const flushRow = () => {
    if (!current) return;
    flushCell();
    while (current.length && !current[current.length - 1].trim()) current.pop();
    if (current.some(cell => cell.trim())) tableRows.push(current);
    current = null;
    currentCell = "";
  };

  for (let i = 0; i < chunk.length; i += 1) {
    const line = chunk[i];
    if (/^\s*Note\s*:/i.test(line)) break;

    const dateAtStart = /^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/.test(line.trim());
    const isHeader = i === 0 || (normalizeHeader(line.replace(/\t/g, " ")).includes("date") && normalizeHeader(line.replace(/\t/g, " ")).includes("breakfast"));

    if (isHeader || dateAtStart) {
      flushRow();
      current = [];
      const parts = line.split("\t");
      parts.forEach((part, index) => {
        if (index === 0) currentCell = part;
        else {
          flushCell();
          currentCell = part;
        }
      });
      continue;
    }

    if (!current) continue;
    if (line.includes("\t")) {
      const parts = line.split("\t");
      currentCell = `${currentCell}${currentCell ? "\n" : ""}${parts[0]}`;
      for (let p = 1; p < parts.length; p += 1) {
        flushCell();
        currentCell = parts[p];
      }
    } else {
      currentCell = `${currentCell}${currentCell ? "\n" : ""}${line}`;
    }
  }
  flushRow();

  return { tableRows, notes: extractNotesFromText(body) };
}

function parseHtmlTables(html: string): { tableRows: string[][]; notes: string } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));
  for (const table of tables) {
    const tableRows = Array.from(table.querySelectorAll("tr")).map(tr =>
      Array.from(tr.querySelectorAll("th,td")).map(cell => cellTextFromHtml(cell as Element)),
    );
    if (tableRows.some(row => mapHeaderIndexes(row))) {
      const after = table.nextElementSibling;
      let notes = "";
      if (after) {
        const block = (after.textContent ?? "").trim();
        if (/^note\s*:/i.test(block) || block.toLowerCase().includes("note:")) {
          notes = extractNotesFromText(block.startsWith("Note") ? block : `Note: ${block}`);
        }
      }
      if (!notes) notes = extractNotesFromText(doc.body.textContent ?? "");
      return { tableRows, notes };
    }
  }
  throw new Error("Couldn’t find a menu table with Date, Breakfast, AM Snacks, Lunch, PM Snacks, and Dinner columns.");
}

async function extractDocxHtml(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer }, {
    convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: "" })),
  });
  return result.value;
}

async function extractDocBody(buffer: ArrayBuffer): Promise<string> {
  const { Buffer } = await import("buffer");
  const WordExtractor = (await import("word-extractor")).default;
  const extractor = new WordExtractor();
  const document = await extractor.extract(Buffer.from(buffer));
  return document.getBody();
}

export async function importWordMenu(file: File): Promise<MenuImportResult> {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".doc") && !name.endsWith(".docx")) {
    throw new Error("Please choose a Word .doc or .docx menu file.");
  }

  const buffer = await file.arrayBuffer();
  try {
    if (name.endsWith(".docx")) {
      const html = await extractDocxHtml(buffer);
      const { tableRows, notes } = parseHtmlTables(html);
      return buildRows(tableRows, notes);
    }
    const body = await extractDocBody(buffer);
    const { tableRows, notes } = parseTabularBody(body);
    return buildRows(tableRows, notes);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Couldn’t read this Word menu file.");
  }
}

export function validateImportRows(rows: ImportedMenuRow[]): boolean {
  return rows.length > 0 && rows.every(row => row.eventDate && row.issues.length === 0);
}

export function blankMenuDay(eventDate = ""): ImportedMenuRow {
  return {
    rawDate: eventDate,
    eventDate,
    breakfast: "",
    amSnacks: "",
    lunch: "",
    pmSnacks: "",
    dinner: "",
    issues: eventDate ? [] : ["Missing date"],
  };
}

export function revalidateRows(rows: ImportedMenuRow[]): ImportedMenuRow[] {
  const seen = new Map<string, number>();
  return rows.map((row, index) => {
    const issues: string[] = [];
    const eventDate = row.eventDate || parseMenuDate(row.rawDate) || "";
    if (!eventDate) issues.push(row.rawDate || row.eventDate ? "Invalid date" : "Missing date");
    if (eventDate) {
      const prior = seen.get(eventDate);
      if (prior != null) issues.push("Duplicate date");
      else seen.set(eventDate, index);
    }
    return { ...row, eventDate, rawDate: row.rawDate || eventDate, issues };
  }).map((row, _, all) => {
    if (!row.eventDate) return row;
    const dupes = all.filter(item => item.eventDate === row.eventDate);
    if (dupes.length > 1 && !row.issues.includes("Duplicate date")) {
      return { ...row, issues: [...row.issues, "Duplicate date"] };
    }
    return row;
  });
}
