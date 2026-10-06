import type { SpellingIssue } from "./spellcheck";
import type { GrammarIssue } from "./grammarcheck";

export interface Segment {
  text: string;
  type: "none" | "spelling" | "grammar";
  tooltip?: string;
}

export function buildSegments(text: string, spelling: SpellingIssue[], grammar: GrammarIssue[]): Segment[] {
  type Span = { start: number; end: number; type: "spelling" | "grammar"; tooltip: string };

  const grammarSpans: Span[] = grammar.map((g) => ({
    start: g.offset,
    end: g.offset + g.length,
    type: "grammar",
    tooltip: g.replacements.length ? `${g.shortMessage} → ${g.replacements.join(", ")}` : g.shortMessage,
  }));

  // Grammar takes priority where spans overlap, since it's usually the more specific finding.
  const spellingSpans: Span[] = spelling
    .filter((s) => !grammarSpans.some((g) => s.offset < g.end && s.offset + s.length > g.start))
    .map((s) => ({
      start: s.offset,
      end: s.offset + s.length,
      type: "spelling",
      tooltip: s.suggestions.length ? `Possible typo → ${s.suggestions.join(", ")}` : "Possible typo",
    }));

  const spans = [...grammarSpans, ...spellingSpans].sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue;
    if (span.start > cursor) segments.push({ text: text.slice(cursor, span.start), type: "none" });
    segments.push({ text: text.slice(span.start, span.end), type: span.type, tooltip: span.tooltip });
    cursor = span.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), type: "none" });

  return segments;
}