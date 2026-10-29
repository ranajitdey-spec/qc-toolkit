import { decodeHTML } from "entities";

// Python's str.strip() and re's \s use the same Unicode whitespace set, which is
// slightly different from JavaScript's. Mirroring it keeps output identical to the script.
const PY_WS = "\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const PY_STRIP = new RegExp(`^[${PY_WS}]+|[${PY_WS}]+$`, "g");
const MULTI_NEWLINES = new RegExp(`\\n[${PY_WS}]*\\n`, "g");

const BREAK_TAGS = /<\s*(?:br\s*\/?|\/\s*div|\/\s*p)\s*>/gi;
const HTML_TAG = /<[^>]+>/g;
const INLINE_WS = /[ \t]+/g;

function pyStrip(s: string): string {
  return s.replace(PY_STRIP, "");
}

/** Port of clean_card_message from the Python script, step for step. */
export function cleanCardMessage(text: string | null | undefined): string {
  if (text === null || text === undefined) return "";

  let content = String(text);

  // 1. Structural line-ending tags become newlines
  content = content.replace(BREAK_TAGS, "\n");
  // 2. Strip every remaining tag
  content = content.replace(HTML_TAG, "");
  // 3. Decode HTML entities
  if (content.includes("&")) content = decodeHTML(content);
  // 4. Non-breaking spaces become regular spaces
  content = content.replace(/\u00a0/g, " ");
  // 5. Collapse inline whitespace per line, keep intentional newlines
  const lines = content.split("\n").map((line) => pyStrip(line.replace(INLINE_WS, " ")));
  let cleaned = pyStrip(lines.join("\n"));
  // 6. Blank lines collapse (matches the script's actual behaviour: \n\s*\n -> \n)
  cleaned = cleaned.replace(MULTI_NEWLINES, "\n");

  return cleaned;
}

// ---------- Column cleaning (chunked so the page stays responsive) ----------

export const DEFAULT_COLUMN = "card_message";
export const SAMPLE_THRESHOLD = 5000; // above this many rows, only a sample is shown in the preview
export const SAMPLE_SIZE = 5;

/**
 * Cleans one column of every data row (rows[0] is the header).
 * Yields to the browser every ~12ms. Returns null if cancelled.
 * Entry i of the result belongs to rows[i + 1]; undefined means the row has no such column.
 */
export async function cleanColumn(
  rows: string[][],
  colIdx: number,
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<(string | undefined)[] | null> {
  const total = rows.length - 1;
  const out: (string | undefined)[] = new Array(Math.max(total, 0));
  let last = performance.now();

  for (let i = 0; i < total; i++) {
    const raw = rows[i + 1][colIdx];
    out[i] = raw === undefined ? undefined : cleanCardMessage(raw);

    if (performance.now() - last > 12) {
      if (isCancelled()) return null;
      onProgress(i + 1, total);
      await new Promise((r) => setTimeout(r, 0));
      last = performance.now();
    }
  }

  onProgress(total, total);
  return out;
}

export interface PreviewGroup {
  label: string;
  indices: number[]; // 0-based data-row indices
}

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, k) => from + k);

/** Small files: every row. Large files: first 5, middle 5, last 5. */
export function buildPreviewGroups(total: number): PreviewGroup[] {
  if (total <= SAMPLE_THRESHOLD) {
    return [{ label: `All ${total.toLocaleString()} rows`, indices: range(0, total) }];
  }
  const midStart = Math.floor(total / 2) - 2;
  return [
    { label: `First ${SAMPLE_SIZE} rows`, indices: range(0, SAMPLE_SIZE) },
    {
      label: `Middle ${SAMPLE_SIZE} rows (${(midStart + 1).toLocaleString()} to ${(midStart + SAMPLE_SIZE).toLocaleString()})`,
      indices: range(midStart, midStart + SAMPLE_SIZE),
    },
    {
      label: `Last ${SAMPLE_SIZE} rows (${(total - SAMPLE_SIZE + 1).toLocaleString()} to ${total.toLocaleString()})`,
      indices: range(total - SAMPLE_SIZE, total),
    },
  ];
}