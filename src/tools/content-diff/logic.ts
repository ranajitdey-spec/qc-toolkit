import { diffWords, type Change } from "diff";

/** Strips HTML tags and decodes entities correctly via the browser's own parser. */
export function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeRaw(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export interface EncodingFlag {
  snippet: string;
  note: string;
}

const MOJIBAKE_PATTERNS: [RegExp, string][] = [
  [/â€™/g, "Mojibake apostrophe (â€™) — likely UTF-8 content served/read as Latin-1."],
  [/â€œ|â€\x9d/g, "Mojibake curly quote (â€œ / â€\x9d) — likely UTF-8 read as Latin-1."],
  [/â€“|â€”/g, "Mojibake dash (â€“ / â€”) — likely UTF-8 read as Latin-1."],
  [/Ã©|Ã¨|Ã¢|Ã‰/g, "Mojibake accented character (Ã...) — likely UTF-8 read as Latin-1."],
  [/Â /g, "Stray 'Â' before a space — classic UTF-8-as-Latin1 artifact."],
];

const LITERAL_ENTITY = /&[a-zA-Z#][a-zA-Z0-9]*;/g;

export function detectEncodingFlags(text: string, label: string): EncodingFlag[] {
  const flags: EncodingFlag[] = [];

  for (const [pattern, note] of MOJIBAKE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      flags.push({ snippet: `${label}: "${matches[0]}"`, note });
    }
  }

  const entityMatches = text.match(LITERAL_ENTITY);
  if (entityMatches) {
    const unique = [...new Set(entityMatches)].slice(0, 5).join(", ");
    flags.push({
      snippet: `${label}: ${unique}`,
      note: "Literal HTML entity left undecoded in plain text — check how this content was pasted/exported.",
    });
  }

  return flags;
}

export function computeDiff(left: string, right: string): Change[] {
  return diffWords(left, right);
}