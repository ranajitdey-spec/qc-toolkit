export interface AssetItem {
  type: string;
  url: string;
  filename: string;
}

export interface ExtractResult {
  valid: boolean;
  url: string;
  title: string | null;
  subtitle: string | null;
  uploadDate: string | null;
  generatedDate: string | null;
  generatedVersion: string | null;
  catQ1: string | null;
  subCatQ1: string | null;
  cardId: string | null;
  assets: AssetItem[];
  error?: string;
  }

export function formatUploadDate(iso: string | null): string {
  if (!iso) return "Not found";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(d) + " UTC";
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(result: ExtractResult): string {
  const rows: [string, string][] = [
    ["Field", "Value"],
    ["URL", result.url],
    ["Title", result.title ?? ""],
    ["Subtitle", result.subtitle ?? ""],
    ["Upload Date (raw)", result.uploadDate ?? ""],
    ["Upload Date (readable)", formatUploadDate(result.uploadDate)],
    ["Generated Date", result.generatedDate ?? ""],
    ["Generated Version", result.generatedVersion ?? ""],
    ["Category (q1)", result.catQ1 ?? ""],
    ["Sub-category (q1)", result.subCatQ1 ?? ""],
    ["Card ID", result.cardId ?? ""],
  ];
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

export function toText(result: ExtractResult): string {
  return [
    `URL: ${result.url}`,
    `Title: ${result.title ?? "Not found"}`,
    `Subtitle: ${result.subtitle ?? "Not found"}`,
    `Upload Date: ${formatUploadDate(result.uploadDate)}`,
    `Generated: ${result.generatedDate ?? "Not found"} (v${result.generatedVersion ?? "?"})`,
     `Category: ${result.catQ1 ?? "Not found"} / ${result.subCatQ1 ?? "Not found"} · Card ID: ${result.cardId ?? "Not found"}`,
  ].join("\n");
}