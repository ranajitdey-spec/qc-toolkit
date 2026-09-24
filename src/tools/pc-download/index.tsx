import { useState } from "react";
import type { PcExtractResult } from "./logic";
import { logEvent } from "../../lib/log";
import sharedStyles from "../shared.module.css";
import styles from "./styles.module.css";

export default function PcDownload() {
  const [cardUrl, setCardUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PcExtractResult | null>(null);

  async function handleFetch() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/extract-pc?url=${encodeURIComponent(cardUrl)}`);
      const data: PcExtractResult = await res.json();
      if (!data.valid) {
        setError(data.error ?? "Could not extract image.");
      } else {
        setResult(data);
        logEvent("pc-download", "extract", { url: cardUrl });
      }
    } catch {
      setError("Request failed.");
    } finally {
      setLoading(false);
    }
  }

  function downloadImage() {
    if (!result?.pcUrl || !result.filename) return;
    const a = document.createElement("a");
    a.href = `/api/download-asset?url=${encodeURIComponent(result.pcUrl)}&filename=${encodeURIComponent(result.filename)}`;
    a.download = result.filename;
    a.click();
    logEvent("pc-download", "download", { filename: result.filename });
  }

  const previewSrc = result?.pcUrl
    ? `/api/download-asset?url=${encodeURIComponent(result.pcUrl)}&filename=${encodeURIComponent(result.filename ?? "pc.jpg")}&inline=1`
    : null;

  return (
    <div className={sharedStyles.page}>
      <h1 className={sharedStyles.title}>PC Image Download</h1>
      <p className={sharedStyles.sub}>Paste a 123Greetings card URL — pulls just the _pc image, nothing else.</p>

      <div className={styles.controls}>
        <input
          className={styles.textInput}
          style={{ width: 420 }}
          placeholder="https://www.123greetings.com/.../slug.html"
          value={cardUrl}
          onChange={(e) => setCardUrl(e.target.value)}
        />
        <button className={styles.btn} onClick={handleFetch} disabled={loading || !cardUrl}>
          {loading ? "Fetching…" : "Get Image"}
        </button>
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

      {result?.valid && previewSrc && (
        <div className={styles.previewBox}>
          <img className={styles.preview} src={previewSrc} alt="Card PC preview" />
          <div className={styles.controls} style={{ marginTop: 8, marginBottom: 0 }}>
            <span className={styles.filename}>{result.filename}</span>
            <button className={styles.btn} onClick={downloadImage}>
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}