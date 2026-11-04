import { useMemo, useState } from "react";
import { encodeNonAscii, listSpecialChars, parseFaqBlocks, wrapFaq, wrapParagraphs, type Section } from "./logic";
import { copyToClipboard } from "../../lib/clipboard";
import { logEvent } from "../../lib/log";
import styles from "../shared.module.css";


const SECTIONS: { label: string; value: Section; hint: string }[] = [
  {
    label: "Blurb",
    value: "blurb",
    hint: "Paste the paragraphs with a blank line between each. Each paragraph becomes its own <p>.",
  },
  {
    label: "FAQ",
    value: "faq",
    hint: "Question on the first line, answer on the next line(s), blank line between each Q&A pair. Numbering is added automatically.",
  },
  {
    label: "Footer note",
    value: "footer",
    hint: "Paste the note as a single paragraph (blank-line-separate if there's more than one).",
  },
];

export default function TextToHtml() {
  const [section, setSection] = useState<Section>("blurb");
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [encodeEntities, setEncodeEntities] = useState(true);

  const active = SECTIONS.find((s) => s.value === section)!;

    const output = useMemo(() => {
    const html = section === "faq" ? wrapFaq(parseFaqBlocks(input)) : wrapParagraphs(input);
    return encodeEntities ? encodeNonAscii(html) : html;
  }, [section, input, encodeEntities]);

  const specialChars = useMemo(() => listSpecialChars(input), [input]);
  async function handleCopy() {
    if (!output) return;
    const ok = await copyToClipboard(output);
    if (ok) {
      logEvent("text-to-html", "copy", { section });
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Text to HTML</h1>
      <p className={styles.sub}>Wraps raw text in the CardManager markup — same tags, same classes, same order, every time.</p>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="section">
          Section
        </label>
        <select id="section" className={styles.select} value={section} onChange={(e) => setSection(e.target.value as Section)}>
          {SECTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <p className={styles.sub}>{active.hint}</p>

      <label className={styles.label} htmlFor="input">
        Input
      </label>
      <textarea id="input" className={styles.textarea} rows={10} value={input} onChange={(e) => setInput(e.target.value)} /><label className={styles.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" checked={encodeEntities} onChange={(e) => setEncodeEntities(e.target.checked)} />
        Convert special characters to HTML entities (prevents the � problem)
      </label>
      {specialChars.length > 0 && (
        <p className={styles.sub}>
          Special characters found: {specialChars.map((c) => `${c.char} ×${c.count}`).join(", ")}
        </p>
      )}

      <div className={styles.outputBlock}>
        <div className={styles.outputHeader}>
          <span className={styles.label}>Output HTML</span>
          <button className={styles.copyBtn} onClick={handleCopy} disabled={!output}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className={styles.pre}>{output || " "}</pre>
      </div>
    </div>
  );
}