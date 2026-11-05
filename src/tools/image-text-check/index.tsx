import { useEffect, useMemo, useRef, useState } from "react";
import { readImageText, type OcrLine, type Rect } from "./ocr";
import { checkSpelling, type SpellingIssue } from "../spell-grammar-check/spellcheck";
import { checkGrammar, type GrammarIssue } from "../spell-grammar-check/grammarcheck";
import { buildSegments } from "../spell-grammar-check/segments";
import { logEvent } from "../../lib/log";
import sharedStyles from "../shared.module.css";
import styles from "./styles.module.css";

// Brand words the dictionary doesn't know. Add more here (lowercase).
const IGNORE_WORDS = new Set(["ecard", "ecards", "123greetings"]);

const UNSURE_BELOW = 60; // confidence under this is shown red
const MID_BELOW = 85; // confidence under this is shown amber

interface ReadResult {
  id: string;
  label: string;
  lines: OcrLine[];
}

interface CheckResult {
  text: string;
  labels: string[];
  spelling: SpellingIssue[];
  grammar: GrammarIssue[];
  grammarError: string | null;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function confClass(c: number): string | undefined {
  if (c < UNSURE_BELOW) return styles.confLow;
  if (c < MID_BELOW) return styles.confMid;
  return undefined;
}

export default function ImageTextCheck() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [sel, setSel] = useState<Rect | null>(null);
  const [reads, setReads] = useState<ReadResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [thorough, setThorough] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ignoreUnsure, setIgnoreUnsure] = useState(false);
  const [checked, setChecked] = useState<CheckResult | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const areaCount = useRef(0);

  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFile(f: File | null) {
    if (!f) return;
    setFile(f);
    setDims(null);
    setSel(null);
    setReads([]);
    setSelectedIds(new Set());
    setChecked(null);
    setError(null);
    areaCount.current = 0;
  }

  function toNatural(e: React.PointerEvent) {
    const img = imgRef.current!;
    const r = img.getBoundingClientRect();
    return {
      x: clamp(((e.clientX - r.left) / r.width) * img.naturalWidth, 0, img.naturalWidth),
      y: clamp(((e.clientY - r.top) / r.height) * img.naturalHeight, 0, img.naturalHeight),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!imgRef.current || busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = toNatural(e);
    setSel(null);
  }

  function onPointerMove(e: React.PointerEvent) {
    const start = dragStart.current;
    if (!start || !imgRef.current) return;
    const p = toNatural(e);
    setSel({
      left: Math.min(start.x, p.x),
      top: Math.min(start.y, p.y),
      width: Math.abs(p.x - start.x),
      height: Math.abs(p.y - start.y),
    });
  }

  function onPointerUp() {
    dragStart.current = null;
    setSel((s) => (s && (s.width < 10 || s.height < 10) ? null : s));
  }

  async function handleRead(useSelection: boolean) {
    if (!file) return;
    const rect =
      useSelection && sel
        ? { left: Math.round(sel.left), top: Math.round(sel.top), width: Math.round(sel.width), height: Math.round(sel.height) }
        : null;

    setBusy(true);
    setError(null);
    setChecked(null);
    setStatus("Starting…");
    try {
      const lines = await readImageText(file, rect, thorough, setStatus);
      const label = rect ? `Area ${++areaCount.current}` : "Whole image";
      const id = crypto.randomUUID();
      setReads((prev) => [...prev, { id, label, lines }]);
      setSelectedIds(new Set([id])); // the newest result is the one ticked for checking
      logEvent("image-text-check", "read", { area: Boolean(rect), thorough, lines: lines.length });
    } catch {
      setError(
        "Couldn't read text from this image. If it keeps happening, check that /tesseract/worker.min.js and /tesseract/lang/eng.traineddata.gz open in your browser (if you see a page instead of a download, the files weren't deployed).",
      );
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setChecked(null);
  }

  function removeRead(id: string) {
    setReads((prev) => prev.filter((r) => r.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setChecked(null);
  }

  function clearAll() {
    setReads([]);
    setSelectedIds(new Set());
    setChecked(null);
  }

  const selectedReads = useMemo(() => reads.filter((r) => selectedIds.has(r.id)), [reads, selectedIds]);

  const textToCheck = useMemo(
    () =>
      selectedReads
        .map((r) =>
          r.lines
            .map((l) =>
              l.words
                .filter((w) => !ignoreUnsure || w.confidence >= UNSURE_BELOW)
                .map((w) => w.text)
                .join(" "),
            )
            .filter(Boolean)
            .join("\n"),
        )
        .filter(Boolean)
        .join("\n"),
    [selectedReads, ignoreUnsure],
  );

  async function handleCheck() {
    // Curly apostrophes become straight ones so words like "it's" aren't split in two.
    const text = textToCheck.replace(/[\u2018\u2019]/g, "'");
    const spelling = checkSpelling(text).filter((s) => !IGNORE_WORDS.has(s.word.toLowerCase()));
    const grammar = await checkGrammar(text);
    setChecked({
      text,
      labels: selectedReads.map((r) => r.label),
      spelling,
      grammar: grammar.issues,
      grammarError: grammar.error ?? null,
    });
    logEvent("image-text-check", "check", { spelling: spelling.length, grammar: grammar.issues.length, results: selectedReads.length });
  }

  const segments = checked ? buildSegments(checked.text, checked.spelling, checked.grammar) : [];
  const totalIssues = checked ? checked.spelling.length + checked.grammar.length : 0;

  return (
    <div className={sharedStyles.page} style={{ maxWidth: 900 }}>
      <h1 className={sharedStyles.title}>Image Text Check</h1>
      <p className={sharedStyles.sub}>Reads the text on a banner image, then checks it for spelling and grammar. Runs in your browser.</p>
      <p className={styles.notice}>
        This is a first pass, not a sign-off. Read the banner yourself as well. The first read downloads about 7 MB once, then it is cached.
      </p>

      <div className={styles.controls}>
        <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} disabled={busy} />
      </div>

      {imageUrl && (
        <>
          <p className={styles.legend}>
            Drag a box over the text to read just that area. Photo areas produce junk words, so selecting only the text gives the cleanest result.
          </p>
          <div
            className={styles.imageWrap}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <img
              ref={imgRef}
              className={styles.image}
              src={imageUrl}
              alt="Uploaded banner"
              draggable={false}
              onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            />
            {sel && dims && (
              <div
                className={styles.selection}
                style={{
                  left: `${(sel.left / dims.w) * 100}%`,
                  top: `${(sel.top / dims.h) * 100}%`,
                  width: `${(sel.width / dims.w) * 100}%`,
                  height: `${(sel.height / dims.h) * 100}%`,
                }}
              />
            )}
          </div>

          <div className={styles.controls}>
            <button className={styles.btn} onClick={() => handleRead(true)} disabled={busy || !sel}>
              Read selected area
            </button>
            <button className={styles.btn} onClick={() => handleRead(false)} disabled={busy}>
              Read whole image
            </button>
            <label className={styles.checkLabel} style={{ margin: 0 }}>
              <input type="checkbox" checked={thorough} onChange={(e) => setThorough(e.target.checked)} disabled={busy} />
              Thorough read (tries several sizes, slower, better for big or script lettering)
            </label>
          </div>
        </>
      )}

      {busy && <p className={styles.status}>{status}</p>}
      {error && <p className={styles.error}>{error}</p>}

      {reads.length > 0 && (
        <>
          <div className={styles.controls} style={{ justifyContent: "space-between" }}>
            <p className={styles.legend} style={{ margin: 0 }}>
              Newest result first. Tick the results you want to check; the newest is ticked automatically. Word colors: normal = sure, amber =
              unsure, red = very unsure. Unsure does not mean misspelled, and a real typo can be marked unsure.
            </p>
            <button className={styles.btn} onClick={clearAll} disabled={busy}>
              Clear all
            </button>
          </div>

          {[...reads].reverse().map((r) => {
            const unsure = r.lines.reduce((n, l) => n + l.words.filter((w) => w.confidence < UNSURE_BELOW).length, 0);
            return (
              <div key={r.id} className={styles.readCard}>
                <div className={styles.readHead}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelected(r.id)} />
                    <span>
                      {r.label} <span className={styles.readMeta}>· {unsure} unsure word(s)</span>
                    </span>
                  </label>
                  <button className={styles.btn} onClick={() => removeRead(r.id)}>
                    Remove
                  </button>
                </div>
                {r.lines.length === 0 && <div className={styles.readMeta}>No text found.</div>}
                {r.lines.map((l, i) => (
                  <div key={i} className={styles.line}>
                    {l.words.map((w, j) => (
                      <span key={j} className={confClass(w.confidence)} title={`confidence ${Math.round(w.confidence)}`}>
                        {w.text}{" "}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}

          <label className={styles.checkLabel}>
            <input type="checkbox" checked={ignoreUnsure} onChange={(e) => setIgnoreUnsure(e.target.checked)} />
            Skip red (very unsure) words when checking. Cuts junk from photos, but can also hide a real typo.
          </label>
          <div className={styles.controls}>
            <button className={styles.btn} onClick={handleCheck} disabled={busy || !textToCheck.trim()}>
              Check selected results ({selectedReads.length})
            </button>
          </div>
        </>
      )}

      {checked && (
        <>
          <p className={styles.legend}>Checked: {checked.labels.join(", ")}</p>
          {checked.grammarError && <p className={styles.error}>{checked.grammarError}</p>}
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
            <p className={styles.clean}>No spelling or grammar issues found in the text that was read.</p>
          ) : (
            <div className={styles.issueList}>
              {checked.spelling.map((s, i) => (
                <div key={`s${i}`} className={styles.issue}>
                  <span className={`${styles.issueTag} ${styles.tagSpelling}`}>Spelling</span>
                  <strong>{s.word}</strong>
                  {s.suggestions.length > 0 && <> — suggestions: {s.suggestions.join(", ")}</>}
                </div>
              ))}
              {checked.grammar.map((g, i) => (
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