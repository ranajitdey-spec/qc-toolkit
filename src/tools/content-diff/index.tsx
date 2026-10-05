import { useMemo, useState } from "react";
import { computeDiff, detectEncodingFlags, normalizeRaw, stripHtml } from "./logic";
import sharedStyles from "../shared.module.css";
import styles from "./styles.module.css";

export default function ContentDiff() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [leftIsHtml, setLeftIsHtml] = useState(false);
  const [rightIsHtml, setRightIsHtml] = useState(false);

  const leftText = useMemo(() => (leftIsHtml ? stripHtml(left) : normalizeRaw(left)), [left, leftIsHtml]);
  const rightText = useMemo(() => (rightIsHtml ? stripHtml(right) : normalizeRaw(right)), [right, rightIsHtml]);

  const diff = useMemo(() => computeDiff(leftText, rightText), [leftText, rightText]);

  const flags = useMemo(
    () => [...detectEncodingFlags(leftText, "Left"), ...detectEncodingFlags(rightText, "Right")],
    [leftText, rightText],
  );

  return (
    <div className={sharedStyles.page} style={{ maxWidth: 900 }}>
      <h1 className={sharedStyles.title}>Content Diff</h1>
      <p className={sharedStyles.sub}>Compare expected vs. actual page content — strips HTML when needed, flags encoding issues.</p>

      <div className={styles.grid}>
        <div className={styles.col}>
          <label>
            <input type="checkbox" checked={leftIsHtml} onChange={(e) => setLeftIsHtml(e.target.checked)} />
            Left is HTML
          </label>
          <textarea value={left} onChange={(e) => setLeft(e.target.value)} placeholder="Expected content…" />
        </div>
        <div className={styles.col}>
          <label>
            <input type="checkbox" checked={rightIsHtml} onChange={(e) => setRightIsHtml(e.target.checked)} />
            Right is HTML
          </label>
          <textarea value={right} onChange={(e) => setRight(e.target.value)} placeholder="Dev page content…" />
        </div>
      </div>

      {flags.length > 0 && (
        <div className={styles.flagsBox}>
          {flags.map((f, i) => (
            <div key={i} className={styles.flagItem}>
              <span className={styles.flagSnippet}>{f.snippet}</span> — {f.note}
            </div>
          ))}
        </div>
      )}

      {(left || right) && (
        <div className={styles.diffOutput}>
          {diff.map((part, i) => (
            <span key={i} className={part.added ? styles.added : part.removed ? styles.removed : undefined}>
              {part.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}