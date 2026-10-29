import Papa from "papaparse";

export interface ParsedTable {
  rows: string[][]; // rows[0] is the header
  warnings: string[];
}

export function decodeBytes(buf: ArrayBuffer): { text: string; usedFallback: boolean } {
  try {
    // utf-8 with fatal errors; a leading BOM is stripped automatically (same as utf-8-sig)
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buf), usedFallback: false };
  } catch {
    // "latin1" is an alias for windows-1252 in browsers
    return { text: new TextDecoder("windows-1252").decode(buf), usedFallback: true };
  }
}

export function parseCsvText(text: string): ParsedTable {
  const result = Papa.parse<string[]>(text, { delimiter: ",", skipEmptyLines: true });
  const warnings: string[] = [];
  if (result.errors.length > 0) {
    warnings.push(`${result.errors.length} row(s) had an unexpected number of columns; they are kept as-is.`);
  }
  return { rows: result.data, warnings };
}

export function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    const iso = v.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.slice(0, 19).replace("T", " ");
  }
  return String(v);
}

export function buildCsv(rows: string[][]): string {
  // BOM so Excel opens UTF-8 correctly (matches utf-8-sig in the script)
  return "\uFEFF" + Papa.unparse(rows, { newline: "\r\n" });
}