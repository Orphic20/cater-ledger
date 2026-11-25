import fs from "fs";
import WordExtractor from "word-extractor";
import { Buffer } from "buffer";

function normalizeHeader(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function parseMenuDate(raw) {
  const text = raw.replace(/\u00a0/g, " ").trim();
  const match = text.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (!match) return null;
  let year = Number(match[3]);
  if (year < 100) year += year <= 69 ? 2000 : 1900;
  const month = Number(match[1]);
  const day = Number(match[2]);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseTabularBody(body) {
  const lines = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const startIndex = lines.findIndex(line => {
    const normalized = normalizeHeader(line.replace(/\t/g, " "));
    return normalized.includes("date") && normalized.includes("breakfast");
  });
  if (startIndex < 0) throw new Error("no header");

  const chunk = [];
  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*Prepared by:/i.test(line)) break;
    if (/^\s*Note\s*:/i.test(line)) {
      chunk.push(line);
      break;
    }
    chunk.push(line);
  }

  const tableRows = [];
  let current = null;
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
    const dateAtStart = /^(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b/.test(line.trim());
    const isHeader =
      i === 0 ||
      (normalizeHeader(line.replace(/\t/g, " ")).includes("date") &&
        normalizeHeader(line.replace(/\t/g, " ")).includes("breakfast"));
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
  return tableRows;
}

const extractor = new WordExtractor();
const doc = await extractor.extract(
  Buffer.from(fs.readFileSync("C:/Users/loewi/Catering/Sample doc/December_01-05_2026_Menu.doc")),
);
const rows = parseTabularBody(doc.getBody());
const dataRows = rows.filter(r => parseMenuDate(r[0] || ""));
console.log("total table rows", rows.length, "dated", dataRows.length);
for (const r of dataRows.slice(0, 5)) {
  console.log({
    date: parseMenuDate(r[0]),
    breakfastHasTocino: (r[1] || "").includes("Pork tocino"),
    am: (r[2] || "").split("\n")[0],
    pm: (r[4] || "").split("\n")[0],
  });
}
