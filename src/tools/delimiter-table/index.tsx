import { useMemo, useState } from "react";
import { parseRows, toAsciiTable, toDelimited } from "./logic";
import { copyToClipboard } from "../../lib/clipboard";
import { logEvent } from "../../lib/log";
import styles from "../shared.module.css";

const DELIMITERS: { label: string; value: string }[] = [
  { label: ", (comma)", value: ", " },
  { label: "\\t (tab)", value: "\t" },
  { label: "| (pipe)", value: " | " },
];

export default function DelimiterTable() {
  const [input, setInput] = useState("");
  const [delimiter, setDelimiter] = useState(DELIMITERS[0].value);
  const [copiedField, setCopiedField] = useState<"delimited" | "table" | null>(null);

  const rows = useMemo(() => parseRows(input), [input]);
  const delimited = useMemo(() => toDelimited(rows, delimiter), [rows, delimiter]);
  const table = useMemo(() => toAsciiTable(rows), [rows]);

  async function handleCopy(text: string, field: "delimited" | "table") {
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedField(field);
      logEvent("delimiter-table", "copy", { field });
      setTimeout(() => setCopiedField(null), 1200);
    }
  }

  return (
    <div>
      <h1 className={styles.title}>Delimiter + Table</h1>
      <p className={styles.sub}>
        Paste column names separated by spaces. First line becomes the header; extra lines become data rows.
      </p>

      <label className={styles.label} htmlFor="input">
        Input
      </label>
      <textarea
        id="input"
        className={styles.textarea}
        rows={4}
        placeholder="sl id category reason"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <div className={styles.row}>
        <label className={styles.label} htmlFor="delimiter">
          Delimiter
        </label>
        <select id="delimiter" className={styles.select} value={delimiter} onChange={(e) => setDelimiter(e.target.value)}>
          {DELIMITERS.map((d) => (
            <option key={d.label} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.outputBlock}>
        <div className={styles.outputHeader}>
          <span className={styles.label}>Delimited output</span>
          <button className={styles.copyBtn} onClick={() => handleCopy(delimited, "delimited")} disabled={!delimited}>
            {copiedField === "delimited" ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className={styles.pre}>{delimited || " "}</pre>
      </div>

      <div className={styles.outputBlock}>
        <div className={styles.outputHeader}>
          <span className={styles.label}>Terminal table</span>
          <button className={styles.copyBtn} onClick={() => handleCopy(table, "table")} disabled={!table}>
            {copiedField === "table" ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className={styles.pre}>{table || " "}</pre>
      </div>
    </div>
  );
}
