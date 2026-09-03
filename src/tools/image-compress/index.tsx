import { useState } from "react";
import { compressToTarget, type CompressResult } from "./compress";
import { logEvent } from "../../lib/log";
import sharedStyles from "../shared.module.css";
import styles from "./styles.module.css";

interface FileEntry {
  id: string;
  file: File;
  selected: boolean;
  status: "idle" | "working" | "done" | "error";
  result?: CompressResult;
}

export default function ImageCompress() {
  const [mode, setMode] = useState<"standard">("standard");
  const [maxSizeKB, setMaxSizeKB] = useState(300);
  const [filterText, setFilterText] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const next: FileEntry[] = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      selected: true,
      status: "idle",
    }));
    setEntries(next);
  }

  function toggleAll(selected: boolean) {
    setEntries((prev) => prev.map((e) => ({ ...e, selected })));
  }

  function toggleOne(id: string) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, selected: !e.selected } : e)));
  }

  function applyFilter() {
    if (!filterText.trim()) return;
    const needle = filterText.trim().toLowerCase();
    setEntries((prev) => prev.map((e) => ({ ...e, selected: e.file.name.toLowerCase().includes(needle) })));
  }

  async function runCompression() {
    const targets = entries.filter((e) => e.selected);
    logEvent("image-compress", "run", { count: targets.length, maxSizeKB });

    for (const target of targets) {
      setEntries((prev) => prev.map((e) => (e.id === target.id ? { ...e, status: "working" } : e)));
      try {
        const result = await compressToTarget(target.file, maxSizeKB);
        setEntries((prev) => prev.map((e) => (e.id === target.id ? { ...e, status: "done", result } : e)));
      } catch {
        setEntries((prev) => prev.map((e) => (e.id === target.id ? { ...e, status: "error" } : e)));
      }
    }
  }

  const selectedCount = entries.filter((e) => e.selected).length;

  return (
    <div className={sharedStyles.page}>
      <h1 className={sharedStyles.title}>Image Compress</h1>
      <p className={sharedStyles.sub}>Target-size JPEG compression, in the browser. Nothing is uploaded anywhere.</p>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${mode === "standard" ? styles.tabActive : ""}`} onClick={() => setMode("standard")}>
          Standard
        </button>
        <button className={styles.tab} disabled title="Reserved for a second compression mode">
          Variant 2
        </button>
      </div>

      <div className={styles.controls}>
        <label>
          Max size (KB)
          <input
            className={styles.numInput}
            type="number"
            min={10}
            value={maxSizeKB}
            onChange={(e) => setMaxSizeKB(Number(e.target.value) || 300)}
          />
        </label>
        <input type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {entries.length > 0 && (
        <>
          <div className={styles.toolbar}>
            <button className={styles.btn} onClick={() => toggleAll(true)}>
              Select all
            </button>
            <button className={styles.btn} onClick={() => toggleAll(false)}>
              Select none
            </button>
            <input
              className={styles.textInput}
              placeholder="filter by filename contains…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            <button className={styles.btn} onClick={applyFilter}>
              Apply filter
            </button>
            <button className={styles.btn} onClick={runCompression} disabled={selectedCount === 0}>
              Compress {selectedCount > 0 ? `(${selectedCount})` : ""}
            </button>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th></th>
                <th>File</th>
                <th>Original</th>
                <th>Result</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>
                    <input type="checkbox" checked={e.selected} onChange={() => toggleOne(e.id)} />
                  </td>
                  <td className={styles.filename}>{e.file.name}</td>
                  <td>{(e.file.size / 1024).toFixed(1)} KB</td>
                  <td>
                    {e.status === "working" && "compressing…"}
                  {e.status === "error" && <span className={styles.statusError}>failed</span>}
                  {e.status === "done" && e.result && (
                    <span className={styles.statusDone}>
                      {e.result.finalKB.toFixed(1)} KB · q{e.result.quality} · -{e.result.reductionPct.toFixed(0)}%
                    </span>
                  )}
                </td>
                <td>
                  {e.status === "done" && e.result && (
                    <a
                      href={URL.createObjectURL(e.result.blob)}
                      download={e.file.name}
                      className={styles.btn}
                      onClick={() => logEvent("image-compress", "download", { name: e.file.name })}
                    >
                      Download
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>)}
    </div>
  );
}