import { useMemo, useRef, useState } from "react";
import readXlsxFile from "read-excel-file/universal";
import { buildCsv, cellToString, decodeBytes, parseCsvText } from "./io";
import { buildPreviewGroups, cleanColumn, DEFAULT_COLUMN, SAMPLE_THRESHOLD } from "./logic";
import { logEvent } from "../../lib/log";
import sharedStyles from "../shared.module.css";
import styles from "./styles.module.css";

interface SheetTable {
  name: string;
  rows: string[][]; // rows[0] is the header
}

interface Source {
  fileName: string;
  sheets: SheetTable[];
  notices: string[];
}

interface CleanResult {
  cleaned: (string | undefined)[];
  changed: number;
  colIdx: number;
}

function findDefaultColumn(header: string[]): number {
  return header.findIndex((h) => h.trim().toLowerCase() === DEFAULT_COLUMN);
}

export default function CsvCleaner() {
  const [source, setSource] = useState<Source | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [colIdx, setColIdx] = useState<number | null>(null);
  const [result, setResult] = useState<CleanResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);

  const rows = source ? source.sheets[sheetIdx].rows : null;
  const header = rows ? rows[0] : [];
  const dataCount = rows ? rows.length - 1 : 0;
  const defaultIdx = useMemo(() => findDefaultColumn(header), [header]);
  const groups = useMemo(() => (result ? buildPreviewGroups(dataCount) : []), [result, dataCount]);

  function resetResult() {
    runId.current++; // cancels any cleaning run in progress
    setResult(null);
    setProgress(null);
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    resetResult();
    setError(null);
    setSource(null);
    setSheetIdx(0);
    setColIdx(null);
    setBusy("Reading file…");
    await new Promise((r) => setTimeout(r, 30)); // let the "Reading" message paint before the heavy work

    try {
      const lower = file.name.toLowerCase();
      let sheets: SheetTable[];
      const notices: string[] = [];

      if (lower.endsWith(".xls")) {
        setError("Old .xls files aren't supported. Save the file as .xlsx or CSV and upload that instead.");
        return;
      } else if (lower.endsWith(".xlsx")) {
        const parsed = await readXlsxFile(file, { trim: false });
        sheets = parsed.map((s) => ({ name: s.sheet, rows: s.data.map((r) => r.map(cellToString)) }));
        if (sheets.length > 1) notices.push(`This workbook has ${sheets.length} sheets. Pick the one you want below.`);
      } else {
        const { text, usedFallback } = decodeBytes(await file.arrayBuffer());
        const table = parseCsvText(text);
        sheets = [{ name: "CSV", rows: table.rows }];
        notices.push(...table.warnings);
        if (usedFallback) notices.push("This file isn't valid UTF-8, so it was read as Windows-1252 (Latin-1).");
      }

      sheets = sheets.filter((s) => s.rows.length > 0);
      if (sheets.length === 0 || sheets[0].rows.length < 2) {
        setError("No data rows found in that file.");
        return;
      }

      setSource({ fileName: file.name, sheets, notices });
      const idx = findDefaultColumn(sheets[0].rows[0]);
      setColIdx(idx >= 0 ? idx : null);
      logEvent("csv-cleaner", "load", { rows: sheets[0].rows.length - 1 });
    } catch {
      setError("Couldn't read that file. Make sure it's a valid CSV or .xlsx file.");
    } finally {
      setBusy(null);
    }
  }

  function handleSheetChange(i: number) {
    resetResult();
    setSheetIdx(i);
    const idx = findDefaultColumn(source!.sheets[i].rows[0]);
    setColIdx(idx >= 0 ? idx : null);
  }

  async function handleClean() {
    if (!rows || colIdx === null) return;
    const token = ++runId.current;
    setResult(null);
    setProgress({ done: 0, total: dataCount });

    const cleaned = await cleanColumn(
      rows,
      colIdx,
      (done, total) => {
        if (token === runId.current) setProgress({ done, total });
      },
      () => token !== runId.current,
    );
    if (!cleaned || token !== runId.current) return;

    let changed = 0;
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] !== undefined && cleaned[i] !== rows[i + 1][colIdx]) changed++;
    }
    setResult({ cleaned, changed, colIdx });
    setProgress(null);
    logEvent("csv-cleaner", "clean", { rows: dataCount, changed });
  }

  function handleDownload() {
    if (!rows || !result || !source) return;
    const out = rows.map((r, i) => {
      if (i === 0) return r;
      const c = result.cleaned[i - 1];
      if (c === undefined) return r;
      const copy = r.slice();
      copy[result.colIdx] = c;
      return copy;
    });
    const blob = new Blob([buildCsv(out)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${source.fileName.replace(/\.[^.]+$/, "")}_cleaned.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    logEvent("csv-cleaner", "download", { rows: dataCount });
  }

  const cleaning = progress !== null;

  return (
    <div className={sharedStyles.page} style={{ maxWidth: 1100 }}>
      <h1 className={sharedStyles.title}>CSV Cleaner</h1>
      <p className={sharedStyles.sub}>
        Strips HTML tags and entities from a column, normalizes spacing, and gives you the cleaned CSV. Runs entirely in your browser.
      </p>

      <div className={styles.controls}>
        <input
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          disabled={busy !== null || cleaning}
        />
      </div>

      {busy && <p className={styles.notice}>{busy}</p>}
      {error && <p className={styles.error}>{error}</p>}

      {source && rows && (
        <>
          <p className={styles.fileInfo}>
            <strong>{source.fileName}</strong> · {dataCount.toLocaleString()} data rows · {header.length} columns
          </p>
          {source.notices.map((n, i) => (
            <p key={i} className={styles.notice}>
              {n}
            </p>
          ))}

          <div className={styles.controls}>
            {source.sheets.length > 1 && (
              <>
                <label className={styles.label} htmlFor="sheet">
                  Sheet
                </label>
                <select id="sheet" className={styles.select} value={sheetIdx} onChange={(e) => handleSheetChange(Number(e.target.value))}>
                  {source.sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label className={styles.label} htmlFor="column">
              Column to clean
            </label>
            <select
              id="column"
              className={styles.select}
              value={colIdx ?? ""}
              onChange={(e) => {
                resetResult();
                setColIdx(e.target.value === "" ? null : Number(e.target.value));
              }}
              disabled={cleaning}
            >
              {colIdx === null && <option value="">Choose a column…</option>}
              {header.map((h, i) => (
                <option key={i} value={i}>
                  {h || `(column ${i + 1})`}
                </option>
              ))}
            </select>
            <button className={styles.btn} onClick={handleClean} disabled={colIdx === null || cleaning}>
              {cleaning ? "Cleaning…" : "Clean column"}
            </button>
          </div>

          {defaultIdx >= 0 ? (
            <p className={styles.notice}>
              <code>{DEFAULT_COLUMN}</code> is selected by default (the standard column in the message table). Choose another column to clean that one instead.
            </p>
          ) : (
            <p className={styles.noticeWarn}>
              No <code>{DEFAULT_COLUMN}</code> column found in this file. Choose the column to clean.
            </p>
          )}

          {progress && (
            <div className={styles.stats}>
              <progress className={styles.progress} value={progress.done} max={progress.total} />
              <span>
                {progress.done.toLocaleString()} / {progress.total.toLocaleString()} rows
              </span>
            </div>
          )}

          {result && (
            <>
              <div className={styles.stats}>
                <span>
                  <strong>{result.changed.toLocaleString()}</strong> of {dataCount.toLocaleString()} rows changed
                </span>
                <button className={styles.btn} onClick={handleDownload}>
                  Download cleaned CSV
                </button>
              </div>

              {dataCount > SAMPLE_THRESHOLD && (
                <p className={styles.notice}>
                  This file has more than {SAMPLE_THRESHOLD.toLocaleString()} rows, so the preview shows a sample (first, middle and last rows). The download still contains every row.
                </p>
              )}
              {result.changed === 0 && <p className={styles.notice}>Nothing needed cleaning in this column.</p>}

              <div className={styles.cmpHead}>
                <span>Row</span>
                <span>Before</span>
                <span>After (green = changed)</span>
              </div>
              <div className={styles.cmpScroll}>
                {groups.map((g) => (
                  <section key={g.label}>
                    <h3 className={styles.groupLabel}>{g.label}</h3>
                    {g.indices.map((i) => {
                      const before = rows[i + 1][result.colIdx] ?? "";
                      const after = result.cleaned[i] ?? "";
                      return (
                        <div className={styles.cmpRow} key={i}>
                          <span className={styles.rowNum}>{i + 1}</span>
                          <pre className={styles.cmpCell}>{before || " "}</pre>
                          <pre className={`${styles.cmpCell} ${before !== after ? styles.cleanedCell : ""}`}>{after || " "}</pre>
                        </div>
                      );
                    })}
                  </section>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}