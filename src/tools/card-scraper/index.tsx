import { useState } from "react";
import { toCsv, toText, formatUploadDate, type ExtractResult, type AssetItem } from "./logic";
import { logEvent } from "../../lib/log";
import sharedStyles from "../shared.module.css";
import styles from "./styles.module.css";

const TYPE_FILTERS = ["video", "pc", "thumb", "icon", "other"];

export default function CardScraper() {
  const [cardUrl, setCardUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function handleExtract() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/extract-card?url=${encodeURIComponent(cardUrl)}`);
      const data: ExtractResult = await res.json();
      if (!data.valid) {
        setError(data.error ?? "Not a valid card page.");
      } else {
        setResult(data);
        setSelected(new Set(data.assets.map((a) => a.url)));
        logEvent("card-scraper", "extract", { assetCount: data.assets.length });
      }
    } catch {
      setError("Request failed.");
    } finally {
      setLoading(false);
    }
  }

  function toggleAsset(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  }

  function selectByType(type: string | "all" | "none") {
    if (!result) return;
    if (type === "all") return setSelected(new Set(result.assets.map((a) => a.url)));
    if (type === "none") return setSelected(new Set());
    setSelected(new Set(result.assets.filter((a) => a.type === type).map((a) => a.url)));
  }

  function downloadAsset(asset: AssetItem) {
    const a = document.createElement("a");
    a.href = `/api/download-asset?url=${encodeURIComponent(asset.url)}&filename=${encodeURIComponent(asset.filename)}`;
    a.download = asset.filename;
    a.click();
    logEvent("card-scraper", "download", { filename: asset.filename });
  }

  function downloadSelected() {
    if (!result) return;
    result.assets.filter((a) => selected.has(a.url)).forEach(downloadAsset);
  }

  function exportAs(format: "csv" | "txt") {
    if (!result) return;
    const content = format === "csv" ? toCsv(result) : toText(result);
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `card-details.${format}`;
    a.click();
    logEvent("card-scraper", "export-metadata", { format });
  }

  const selectedCount = selected.size;

  return (
    <div className={sharedStyles.page}>
      <h1 className={sharedStyles.title}>Card Details</h1>
      <p className={sharedStyles.sub}>Paste a 123Greetings card URL — pulls its video, images, and metadata.</p>

      <div className={styles.controls} style={{ marginBottom: 16 }}>
        <input
          className={styles.textInput}
          style={{ width: 420 }}
          placeholder="https://www.123greetings.com/.../slug.html"
          value={cardUrl}
          onChange={(e) => setCardUrl(e.target.value)}
        />
        <button className={styles.btn} onClick={handleExtract} disabled={loading || !cardUrl}>
          {loading ? "Checking…" : "Extract"}
        </button>
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

         {result && (
        <>
          <div className={styles.metaCard}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Title</span>
              <span>{result.title ?? "Not found"}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Subtitle</span>
              <span>{result.subtitle ?? "Not found"}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Upload date</span>
              <span>{formatUploadDate(result.uploadDate)}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Page generated</span>
              <span>
                {result.generatedDate ?? "Not found"}
                {result.generatedVersion ? ` (v${result.generatedVersion})` : ""}
              </span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Category</span>
              <span>
                {result.catQ1 ?? "?"} / {result.subCatQ1 ?? "?"} · Card ID:{" "}
                <strong>{result.cardId ?? "?"}</strong>
              </span>
            </div>
            <div className={styles.toolbar} style={{ marginTop: 12, marginBottom: 0 }}>
              <button className={styles.btn} onClick={() => exportAs("csv")}>
                Export metadata (CSV)
              </button>
              <button className={styles.btn} onClick={() => exportAs("txt")}>
                Export metadata (TXT)
              </button>
            </div>
          </div>

          <div className={styles.toolbar}>
            <button className={styles.btn} onClick={() => selectByType("all")}>
              Select all
            </button>
            <button className={styles.btn} onClick={() => selectByType("none")}>
              Select none
            </button>
            {TYPE_FILTERS.map((t) => (
              <button key={t} className={styles.btn} onClick={() => selectByType(t)}>
                Only {t}
              </button>
            ))}
            <button className={styles.btn} onClick={downloadSelected} disabled={selectedCount === 0}>
              Download selected ({selectedCount})
            </button>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th></th>
                <th>Type</th>
                <th>Filename</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {result.assets.map((a) => (
                <tr key={a.url}>
                  <td>
                    <input type="checkbox" checked={selected.has(a.url)} onChange={() => toggleAsset(a.url)} />
                  </td>
                  <td>{a.type}</td>
                  <td className={styles.filename}>{a.filename}</td>
                  <td>
                    <button className={styles.btn} onClick={() => downloadAsset(a)}>
                      Download
                    </button>
                  </td>
                </tr>
              ))}
              {result.assets.length === 0 && (
                <tr>
                  <td colSpan={4}>No assets found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}