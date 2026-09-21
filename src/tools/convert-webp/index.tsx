import { useState } from "react";
import { convertToWebp, type ConvertResult } from "./convert";
import { logEvent } from "../../lib/log";
import sharedStyles from "../shared.module.css";
import styles from "./styles.module.css";
import HelpButton from "../../components/HelpButton";
import { convertWebpTour } from "./tour";

interface FileEntry {
  id: string;
  file: File;
  selected: boolean;
  status: "idle" | "working" | "done" | "error";
  result?: ConvertResult;
}

const ACCEPTED = ["image/jpeg", "image/png"];

export default function ConvertWebp() {
  const [entries, setEntries] = useState<FileEntry[]>([]);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const next: FileEntry[] = Array.from(fileList)
      .filter((f) => ACCEPTED.includes(f.type))
      .map((file) => ({
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

  function webpName(originalName: string) {
    const base = originalName.replace(/\.[^.]+$/, "");
    return `${base}.webp`;
  }

  async function runConversion() {
    const targets = entries.filter((e) => e.selected);
    logEvent("convert-webp", "run", { count: targets.length });

    for (const target of targets) {
      setEntries((prev) => prev.map((e) => (e.id === target.id ? { ...e, status: "working" } : e)));
      try {
        const result = await convertToWebp(target.file);
        setEntries((prev) => prev.map((e) => (e.id === target.id ? { ...e, status: "done", result } : e)));
      } catch {
        setEntries((prev) => prev.map((e) => (e.id === target.id ? { ...e, status: "error" } : e)));
      }
    }
  }

  const selectedCount = entries.filter((e) => e.selected).length;
  const doneEntries = entries.filter((e) => e.status === "done" && e.result);

  async function downloadAll() {
    for (const e of doneEntries) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(e.result!.blob);
      a.download = webpName(e.file.name);
      a.click();
    }
    logEvent("convert-webp", "download-all", { count: doneEntries.length });
  }

  return (
    <div className={sharedStyles.page}>
       <h1 className={sharedStyles.title}>
        Convert to WebP
        <HelpButton toolId="convert-webp" steps={convertWebpTour} />
      </h1>
      <p className={sharedStyles.sub}>JPG/JPEG/PNG to lossless WebP, in the browser. Nothing is uploaded anywhere.</p>

      <div className={styles.controls} style={{ marginBottom: 16 }}>
         <input id="file-input" type="file" accept="image/jpeg,image/png" multiple onChange={(e) => handleFiles(e.target.files)} />
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
             <button id="convert-btn" className={styles.btn} onClick={runConversion} disabled={selectedCount === 0}>
              Convert {selectedCount > 0 ? `(${selectedCount})` : ""}
            </button>
            {doneEntries.length > 0 && (
              <button className={styles.btn} onClick={downloadAll}>
                Download all ({doneEntries.length})
              </button>
            )}
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
                    {e.status === "working" && "converting…"}
                    {e.status === "error" && <span className={styles.statusError}>failed</span>}
                    {e.status === "done" && e.result && (
                      <span className={styles.statusDone}>
                        {webpName(e.file.name)} · {e.result.webpKB.toFixed(1)} KB
                      </span>
                    )}
                  </td>
<td>
  {e.status === "done" && e.result && (
    <a
      href={URL.createObjectURL(e.result.blob)}
      download={webpName(e.file.name)}
      className={styles.btn}
      onClick={() => logEvent("convert-webp", "download", { name: e.file.name })}
    >
      Download
    </a>
  )}
</td>
</tr>
))}
</tbody>
</table>
</>
)}
</div>
);
}