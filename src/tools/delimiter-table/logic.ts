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
