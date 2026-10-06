export interface GrammarIssue {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: string[];
}

interface RawMatch {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  replacements?: { value: string }[];
}

export async function checkGrammar(text: string): Promise<{ issues: GrammarIssue[]; error?: string }> {
  try {
    const res = await fetch(`/api/check-grammar?text=${encodeURIComponent(text)}`);
    const data: { matches?: RawMatch[]; error?: string } = await res.json();
    if (data.error) return { issues: [], error: data.error };

    const issues = (data.matches ?? []).map((m) => ({
      message: m.message,
      shortMessage: m.shortMessage || m.message,
      offset: m.offset,
      length: m.length,
      replacements: (m.replacements ?? []).map((r) => r.value).slice(0, 5),
    }));
    return { issues };
  } catch {
    return { issues: [], error: "Grammar check request failed." };
  }
}