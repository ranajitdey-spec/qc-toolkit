export type Section = "blurb" | "faq" | "footer";

export interface FaqItem {
  question: string;
  answer: string;
}

/** Splits on blank lines, trims each paragraph, wraps each in <p>. */
export function wrapParagraphs(raw: string): string {
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs.map((p) => `<p>${p}</p>`).join("\n");
}

/**
 * FAQ input: one line per question, one (or more) lines per answer, no
 * blank lines required. A question is any line ending in "?" — everything
 * after it, up to the next "?"-ending line, is the answer.
 */
export function parseFaqBlocks(raw: string): FaqItem[] {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const items: FaqItem[] = [];
  let current: FaqItem | null = null;

  for (const line of lines) {
    if (line.endsWith("?")) {
      if (current) items.push(current);
      current = { question: line, answer: "" };
    } else if (current) {
      current.answer = current.answer ? `${current.answer} ${line}` : line;
    }
  }
  if (current) items.push(current);

  return items;
}



export function wrapFaq(items: FaqItem[]): string {
  if (items.length === 0) return "";
  const header = `<div class="faqs">\n<h3 class="ftitle">Frequently Asked Questions</h3>`;
  const body = items
    .map((it, i) => `<div class="faqItem">\n<h4>${i + 1}. ${it.question}</h4>\n<p>${it.answer}</p>\n</div>`)
    .join("\n");
  return `${header}\n${body}\n</div>`;
}