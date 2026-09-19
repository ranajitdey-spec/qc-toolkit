import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyIconBaseName,
  captureVideoFrame,
  classifyFiles,
  parseCardEmail,
  type ClassifiedFile,
  type ParsedCardEmail,
} from "./logic";
import { copyToClipboard } from "../../lib/clipboard";
import { logEvent } from "../../lib/log";
import sharedStyles from "../shared.module.css";
import styles from "./styles.module.css";

const FIELDS: { key: keyof ParsedCardEmail; label: string }[] = [
  { key: "q1", label: "Q1" },
  { key: "fontColor", label: "Font Color" },
  { key: "cardTags", label: "Card Tags" },
  { key: "redLine", label: "Red Line" },
  { key: "greenLine", label: "Green Line" },
];

function categoryLabel(cat: ClassifiedFile["category"]): string {
  switch (cat) {
    case "video":
      return "Video";
    case "bg":
      return "Background (100x100)";
    case "th":
      return "Thumbnail (115x115)";
    case "icon":
      return "Icon (60x60)";
    default:
      return "Unrecognized";
  }
}

export default function AppCard() {
  // --- Email metadata ---
  const [raw, setRaw] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const parsed = useMemo(() => parseCardEmail(raw), [raw]);

  async function handleCopy(key: string, value: string | null) {
    if (!value) return;
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopiedKey(key);
      logEvent("app-card", "copy", { field: key });
      setTimeout(() => setCopiedKey(null), 1200);
    }
  }

  // --- File classification ---
const [baseId, setBaseId] = useState("");
  const [classified, setClassified] = useState<ClassifiedFile[]>([]);
  const [iconInputs, setIconInputs] = useState<Record<string, string>>({});
  const [iconErrors, setIconErrors] = useState<Record<string, string>>({});

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || !baseId.trim()) return;
    const results = await classifyFiles(Array.from(fileList), baseId.trim());
    setClassified(results);
    logEvent("app-card", "classify", { count: results.length });
  }

   function applyIconInput(id: string) {
    const entry = classified.find((c) => c.id === id);
    if (!entry) return;
    const ext = (entry.file.name.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();
    const newName = applyIconBaseName(iconInputs[id] ?? "", ext);

    if (!newName) {
      setIconErrors((prev) => ({ ...prev, [id]: "Must be name-number, e.g. friend_thoughts-155 (hyphen before the number, not an underscore)." }));
      return;
    }
    setIconErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setClassified((prev) => prev.map((c) => (c.id === id ? { ...c, newName, needsIconBaseName: false } : c)));
  }

  function downloadFile(entry: ClassifiedFile) {
    if (!entry.newName) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(entry.file);
    a.download = entry.newName;
    a.click();
    logEvent("app-card", "download-renamed", { name: entry.newName });
  }

  // --- Video frame capture ---
  const videoEntry = classified.find((c) => c.category === "video");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [scrubTime, setScrubTime] = useState(0);
  const [frameBlob, setFrameBlob] = useState<Blob | null>(null);
  const [pcFilename, setPcFilename] = useState("");

  useEffect(() => {
    if (!videoEntry) {
      setVideoUrl(null);
      return;
    }
    const url = URL.createObjectURL(videoEntry.file);
    setVideoUrl(url);
    setPcFilename(`${baseId.trim() || "card"}_pc.jpg`);
    setFrameBlob(null);
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoEntry?.id]);

  function handleLoadedMetadata() {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration;
    setDuration(d);
    const lastFrameTime = Math.max(0, d - 0.05);
    setScrubTime(lastFrameTime);
    v.currentTime = lastFrameTime;
  }

  function handleScrub(time: number) {
    setScrubTime(time);
    if (videoRef.current) videoRef.current.currentTime = time;
  }

  async function handleCapture() {
    if (!videoRef.current) return;
    const blob = await captureVideoFrame(videoRef.current, 0.85);
    setFrameBlob(blob);
    logEvent("app-card", "capture-frame", { time: scrubTime });
  }

  function downloadFrame() {
    if (!frameBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(frameBlob);
    a.download = pcFilename || "card_pc.jpg";
    a.click();
    logEvent("app-card", "download-pc", { name: pcFilename });
  }

  return (
    <div className={sharedStyles.page}>
      <h1 className={sharedStyles.title}>App Card Details</h1>
      <p className={sharedStyles.sub}>Paste the App Only Card email, then upload the four attached files.</p>

      <label className={sharedStyles.label} htmlFor="raw">
        Email text
      </label>
      <textarea id="raw" className={sharedStyles.textarea} rows={10} value={raw} onChange={(e) => setRaw(e.target.value)} />

      <div className={styles.metaCard}>
        {FIELDS.map((f) => (
          <div key={f.key} className={styles.metaRow}>
            <span className={styles.metaLabel}>{f.label}</span>
            <span className={styles.metaValue}>{parsed[f.key] ?? "Not found"}</span>
            <button className={styles.copyBtn} onClick={() => handleCopy(f.key, parsed[f.key])} disabled={!parsed[f.key]}>
              {copiedKey === f.key ? "Copied" : "Copy"}
            </button>
          </div>
        ))}
      </div>

      <h2 className={sharedStyles.title} style={{ fontSize: 16 }}>
        File renaming
      </h2>

      <div className={styles.controls}>
        <input
          className={styles.textInput}
          placeholder="Base ID (e.g. 1036-018-59-8191)"
          value={baseId}
          onChange={(e) => setBaseId(e.target.value)}
        />
        <input
          type="file"
          accept="video/mp4,image/jpeg,image/png"
          multiple
          disabled={!baseId.trim()}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {!baseId.trim() && <p className={sharedStyles.sub}>Enter a Base ID before choosing files.</p>}

      {classified.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Original</th>
              <th>New name</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {classified.map((c) => (
              <tr key={c.id}>
                <td>{categoryLabel(c.category)}</td>
                <td className={styles.filename}>{c.file.name}</td>
                <td className={styles.filename}>
                 {c.newName ? (
                    <span className={styles.statusDone}>{c.newName}</span>
                  ) : c.needsIconBaseName ? (
                    <div>
                      <span className={styles.iconInputRow}>
                        <input
                          className={styles.textInput}
                          style={{ width: 160 }}
                          placeholder="e.g. friend_thoughts-155"
                          value={iconInputs[c.id] ?? ""}
                          onChange={(e) => setIconInputs((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        />
                        <button className={styles.btn} onClick={() => applyIconInput(c.id)}>
                          Apply
                        </button>
                      </span>
                      {iconErrors[c.id] && <div className={styles.statusWarn}>{iconErrors[c.id]}</div>}
                    </div>
                  ) : (
                    <span className={styles.statusWarn}>Unrecognized — not renamed</span>
                  )}
                </td>
                <td>
                  {c.newName && (
                    <button className={styles.btn} onClick={() => downloadFile(c)}>
                      Download
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {videoEntry && videoUrl && (
        <div className={styles.videoBox}>
          <h2 className={sharedStyles.title} style={{ fontSize: 16 }}>
            Generate _pc image from video
          </h2>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} src={videoUrl} onLoadedMetadata={handleLoadedMetadata} controls />
          <div className={styles.scrubRow}>
            <span>0:00</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={scrubTime}
              onChange={(e) => handleScrub(Number(e.target.value))}
            />
            <span>{duration.toFixed(2)}s</span>
          </div>
          <div className={styles.toolbar} style={{ marginBottom: 8 }}>
            <button className={styles.btn} onClick={() => handleScrub(Math.max(0, duration - 0.05))}>
              Jump to last frame
            </button>
            <button className={styles.btn} onClick={handleCapture}>
              Capture frame at {scrubTime.toFixed(2)}s
            </button>
          </div>

          {frameBlob && (
            <>
              <img className={styles.framePreview} src={URL.createObjectURL(frameBlob)} alt="Captured frame preview" />
              <div className={styles.controls} style={{ marginTop: 8 }}>
                <input className={styles.textInput} value={pcFilename} onChange={(e) => setPcFilename(e.target.value)} />
                <button className={styles.btn} onClick={downloadFrame}>
                  Download
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}