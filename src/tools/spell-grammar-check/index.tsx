import { useState } from "react";
import { checkSpelling, type SpellingIssue } from "./spellcheck";
import { checkGrammar, type GrammarIssue } from "./grammarcheck";
import { buildSegments } from "./segments";
import { logEvent } from "../../lib/log";
import sharedStyles from "../shared.module.css";
import styles from "./styles.module.css";

export default function SpellGrammarCheck() {
  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  const [spelling, setSpelling] = useState<SpellingIssue[]>([]);
  const [grammar, setGrammar] = useState<GrammarIssue[]>([]);
  const [grammarError, setGrammarError] = useState<string | null>(null);
  const [checkedText, setCheckedText] = useState("");

  async function handleCheck() {
    if (!text.trim()) return;
    setChecking(true);
    setGrammarError(null);
    try {
      const spellResult = checkSpelling(text);
      const grammarResult = await checkGrammar(text);
      setSpelling(spellResult);
      setGrammar(grammarResult.issues);
      setGrammarError(grammarResult.error ?? null);
      setCheckedText(text);
      logEvent("spell-grammar-check", "check", { spelling: spellResult.length, grammar: grammarResult.issues.length });
    } finally {
      setChecking(false);
    }
  }

  const segments = checkedText ? buildSegments(checkedText, spelling, grammar) : [];
  const totalIssues = spelling.length + grammar.length;

  return (
    <div className={sharedStyles.page}>
      <h1 className={sharedStyles.title}>Spelling &amp; Grammar Check</h1>
      <p className={sharedStyles.sub}>Paste the red-line/title text before it's used — catches typos before they're baked into a URL.</p>

      <textarea
        className={sharedStyles.textarea}
        rows={4}
        placeholder="Paste the text to check…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button className={styles.btn} onClick={handleCheck} disabled={checking || !text.trim()}>
        {checking ? "Checking…" : "Check Text"}
      </button>

      {grammarError && <p style={{ color: "var(--danger)", fontSize: 13 }}>{grammarError}</p>}

      {checkedText && (
        <>
          <div className={styles.annotated}>
            {segments.map((seg, i) =>
              seg.type === "none" ? (
                <span key={i}>{seg.text}</span>
              ) : (
                <span key={i} className={seg.type === "spelling" ? styles.spelling : styles.grammar} title={seg.tooltip}>
                  {seg.text}
                </span>
              ),
            )}
          </div>

          {totalIssues === 0 ? (
            <p className={styles.clean}>No spelling or grammar issues found.</p>
          ) : (
            <div className={styles.issueList}>
              {spelling.map((s, i) => (
                <div key={`s${i}`} className={styles.issue}>
                  <span className={`${styles.issueTag} ${styles.tagSpelling}`}>Spelling</span>
                  <strong>{s.word}</strong>
                  {s.suggestions.length > 0 && <> — suggestions: {s.suggestions.join(", ")}</>}
                </div>
              ))}
              {grammar.map((g, i) => (
                <div key={`g${i}`} className={styles.issue}>
                  <span className={`${styles.issueTag} ${styles.tagGrammar}`}>Grammar</span>
                  {g.message}
                  {g.replacements.length > 0 && <> — try: {g.replacements.join(", ")}</>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}