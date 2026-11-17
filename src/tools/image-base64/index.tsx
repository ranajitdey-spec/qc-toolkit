import { useState } from "react";
import {
  convertFile,
  convertUrl,
  DEFAULT_BASE,
  extractUrls,
  formatBytes,
  formatOutput,
  LARGE_BYTES,
  resolveUrl,
  type ImageResult,
  type OutputFormat,
  type OutputOptions,
} from "./logic";
import { copyToClipboard } from "../../lib/clipboard";
import { logEvent } from "../../lib/log";
import sharedStyles from "../shared.module.css";
import styles from "./styles.module.css";

interface Item {
  id: string;
  source: string;
  status: "working" | "done" | "error";
  error?: string;
  result?: ImageResult;
}

const short = (s: string) => (s.length > 48 ? `${s.slice(0, 48)}…` : s);

export default function ImageBase64() {
  const [urlText, setUrlText] = useState("");
  const [base, setBase] = useState(DEFAULT_BASE);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [format, setFormat] = useState<OutputFormat>("img");
  const [alt, setAlt] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [spanPrefix, setSpanPrefix] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const opts: OutputOptions = { format, alt, width, height, spanPrefix };
  const done = items.filter((i) => i.status === "done" && i.result);

  function patch(id: string, p: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }

  async function handleConvertUrls() {
    setNote(null);
    try {
      new URL(base);
    } catch {
      setNote("The base URL isn't valid. Use a full address such as https://www.123greetings.com/");
      return;
    }

    const raws = extractUrls(urlText);
    if (raws.length === 0) {
      setNote("Paste at least one image URL first.");
      return;
    }

    const created: Item[] = [];
    const queue: { id: string; url: string }[] = [];
    let inline = 0;
    for (const raw of raws) {
      const r = resolveUrl(raw, base);
      if (r.kind === "inline") {
        inline++;
        continue;
      }
      const id = crypto.randomUUID();
      if (r.kind === "bad") {
        created.push({ id, source: raw, status: "error", error: "Couldn't understand this as a URL." });
      } else {
        created.push({ id, source: r.url, status: "working" });
        queue.push({ id, url: r.url });
      }
    }
    if (inline > 0) setNote(`${inline} value(s) were already inline data URLs and were skipped.`);
    setItems((prev) => [...created, ...prev]);

    setBusy(true);
    // One at a time on purpose: it is gentle on the image server.
    for (const q of queue) {
      try {
        patch(q.id, { status: "done", result: await convertUrl(q.url) });
      } catch (e) {
        patch(q.id, { status: "error", error: e instanceof Error ? e.message : "Conversion failed." });
      }
    }
    setBusy(false);
    logEvent("image-base64", "convert-urls", { count: queue.length });
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setNote(null);
    const created: Item[] = files.map((f) => ({ id: crypto.randomUUID(), source: f.name, status: "working" }));
    setItems((prev) => [...created, ...prev]);

    setBusy(true);
    for (let i = 0; i < files.length; i++) {
      try {
        patch(created[i].id, { status: "done", result: await convertFile(files[i]) });
      } catch (e) {
        patch(created[i].id, { status: "error", error: e instanceof Error ? e.message : "Conversion failed." });
      }
    }
    setBusy(false);
    logEvent("image-base64", "convert-files", { count: files.length });
  }

  async function copyOne(item: Item) {
    if (!item.result) return;
    if (await copyToClipboard(formatOutput(item.result, opts))) {
      setCopiedId(item.id);
      logEvent("image-base64", "copy", { format });
      setTimeout(() => setCopiedId(null), 1200);
    }
  }

  async function copyAll() {
    if (await copyToClipboard(done.map((i) => formatOutput(i.result!, opts)).join("\n\n"))) {
      setCopiedId("all");
      logEvent("image-base64", "copy-all", { count: done.length });
      setTimeout(() => setCopiedId(null), 1200);
    }
  }

  function downloadAll() {
    const text = done.map((i) => formatOutput(i.result!, opts)).join("\n\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    a.download = "base64-images.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    logEvent("image-base64", "download-all", { count: done.length });
  }

  return (
    <div className={sharedStyles.page} style={{ maxWidth: 900 }}>
      <h1 className={sharedStyles.title}>Image to Base64</h1>
      <p className={sharedStyles.sub}>Turns images into data URLs you can paste straight into an HTML or CSS file.</p>

      <div className={styles.explain}>
        <h2>What is this for?</h2>
        <p>
          When you save a 123Greetings page and edit it on your computer, its images stop working. Paths like <code>/images/x.png</code> point at files that
          are not on your machine, and full addresses like <code>https://i.123g.us/...</code> are often refused when the page is opened from a local file,
          because the image server only serves them to requests that come from the 123Greetings site.
        </p>
        <p>
          A <strong>data URL</strong> stores the picture itself inside the HTML, so the image shows up anywhere, even offline. This tool fetches an image (or
          reads a file from your computer), encodes it, and gives you something ready to paste.
        </p>
        <ol>
          <li>Paste image URLs (one per line), or paste a piece of HTML or CSS that contains them. Or choose image files from your computer.</li>
          <li>Pick the output you want: a full <code>&lt;img&gt;</code> tag, a bare data URL, or a CSS <code>background-image</code>.</li>
          <li>Copy the result into your <code>.html</code> file.</li>
        </ol>
        <p style={{ margin: 0 }}>
          Good to know: URLs can only be fetched from 123Greetings image hosts (local files work for any image). Encoding makes an image about 33% bigger as
          text, so use it for small images such as thumbnails and icons. The image bytes are not changed, so quality is identical.
        </p>
      </div>

      <label className={styles.label} htmlFor="urls">
        Image URLs, or HTML/CSS containing them
      </label>
      <textarea
        id="urls"
        className={sharedStyles.textarea}
        rows={5}
        placeholder={"https://i.123g.us/c/enov_thanks_wishes/th/357985_th.jpg\nhttps://i.123g.us/c/enov_thanks_wishes/th/112780_th.gif"}
        value={urlText}
        onChange={(e) => setUrlText(e.target.value)}
      />

      <div className={styles.controls}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="base">
            Page address (used to complete relative paths like /images/x.png)
          </label>
          <input id="base" className={styles.textInput} style={{ width: 380 }} value={base} onChange={(e) => setBase(e.target.value)} />
        </div>
        <button className={styles.btn} onClick={handleConvertUrls} disabled={busy || !urlText.trim()} style={{ alignSelf: "flex-end" }}>
          {busy ? "Working…" : "Convert URLs"}
        </button>
      </div>

      <div className={styles.controls}>
        <span className={styles.checkLabel}>Or from your computer:</span>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = ""; // lets you pick the same file again
            void handleFiles(files);
          }}
        />
      </div>

      <div className={styles.controls}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="format">
            Output
          </label>
          <select id="format" className={styles.select} value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)}>
            <option value="img">{"<img> tag"}</option>
            <option value="dataurl">Data URL only</option>
            <option value="css">CSS background-image</option>
          </select>
        </div>
        {format === "img" && (
          <>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="alt">
                Alt text
              </label>
              <input id="alt" className={styles.textInput} style={{ width: 200 }} value={alt} onChange={(e) => setAlt(e.target.value)} />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="w">
                Width (blank = image size)
              </label>
              <input id="w" className={styles.textInput} style={{ width: 90 }} value={width} onChange={(e) => setWidth(e.target.value)} />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="h">
                Height
              </label>
              <input id="h" className={styles.textInput} style={{ width: 90 }} value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>
            <label className={styles.checkLabel} style={{ alignSelf: "flex-end", paddingBottom: 6 }}>
              <input type="checkbox" checked={spanPrefix} onChange={(e) => setSpanPrefix(e.target.checked)} />
              {"Add an empty <span></span> before each tag (as my old script did)"}
            </label>
          </>
        )}
      </div>

      {note && <p className={styles.notice}>{note}</p>}

      {items.length > 0 && (
        <>
          <div className={styles.controls}>
            <button className={styles.btn} onClick={copyAll} disabled={done.length === 0}>
              {copiedId === "all" ? "Copied" : `Copy all (${done.length})`}
            </button>
            <button className={styles.btn} onClick={downloadAll} disabled={done.length === 0}>
              Download all as .txt
            </button>
            <button className={styles.btn} onClick={() => setItems([])} disabled={busy}>
              Clear
            </button>
          </div>

          <div className={styles.list}>
            {items.map((item) => {
              const r = item.result;
              return (
                <div key={item.id} className={styles.item}>
                  {r && <img className={styles.thumb} src={r.dataUrl} alt="" />}
                  <div className={styles.itemBody}>
                    <div className={styles.source}>{item.source}</div>
                    {item.status === "working" && <div className={styles.meta}>Converting…</div>}
                    {item.status === "error" && <div className={styles.error}>{item.error}</div>}
                    {r && (
                      <>
                        <div className={styles.meta}>
                          {r.mime}
                          {r.width && r.height ? ` · ${r.width}×${r.height}` : ""} · {formatBytes(r.bytes)} as a file, {formatBytes(r.dataUrl.length)} as text
                        </div>
                        {r.bytes > LARGE_BYTES && (
                          <div className={styles.warn}>
                            Large image: it will add about {formatBytes(r.dataUrl.length)} to your HTML. Consider compressing it first (Image Compress or
                            Convert to WebP).
                          </div>
                        )}
                        <pre className={styles.preview}>{formatOutput({ ...r, dataUrl: short(r.dataUrl) }, opts)}</pre>
                      </>
                    )}
                  </div>
                  {r && (
                    <div className={styles.actions}>
                      <button className={styles.btn} onClick={() => copyOne(item)}>
                        {copiedId === item.id ? "Copied" : "Copy"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}