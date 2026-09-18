export type Row = string[];

/**
 * One line per row, cells split on whitespace.
 * Paste "sl id category reason" -> one row of four cells.
 * Paste multiple lines -> first line is treated as the header row.
 */
export function parseRows(input: string): Row[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/));
}

export function toDelimited(rows: Row[], delimiter = ", "): string {
  return rows.map((r) => r.join(delimiter)).join("\n");
}

export function toAsciiTable(rows: Row[]): string {
  if (rows.length === 0) return "";

  const colCount = Math.max(...rows.map((r) => r.length));
  const widths: number[] = [];
  for (let c = 0; c < colCount; c++) {
    widths[c] = Math.max(...rows.map((r) => (r[c] ?? "").length));
  }

  const sep = "+" + widths.map((w) => "-".repeat(w + 2)).join("+") + "+";
  const renderRow = (r: Row) => "|" + widths.map((w, c) => ` ${(r[c] ?? "").padEnd(w)} `).join("|") + "|";

  const lines = [sep, renderRow(rows[0]), sep];
  for (let i = 1; i < rows.length; i++) {
    lines.push(renderRow(rows[i]));
  }
  if (rows.length > 1) lines.push(sep);

  return lines.join("\n");
}

/**
 * Full single-pass CSV parser: handles quoted fields, escaped "" quotes,
 * and — importantly — real line breaks inside quoted fields (common in
 * exported CSVs with multi-line text columns). Only unquoted newlines
 * count as row boundaries.
 */
export function parseCsv(text: string): Row[] {
  const rows: Row[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      field = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  // Last row (file may not end with a trailing newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((c) => c.length > 0)) rows.push(row);
  }

  return rows;
}