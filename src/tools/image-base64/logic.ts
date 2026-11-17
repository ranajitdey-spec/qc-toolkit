export const DEFAULT_BASE = "https://www.123greetings.com/";
export const LARGE_BYTES = 200 * 1024; // above this, warn that the HTML will get heavy

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  bmp: "image/bmp",
  avif: "image/avif",
};

/** Guesses an image MIME type from a file name or URL (query string and hash ignored). */
export function mimeFromName(name: string): string | null {
  const clean = name.split(/[?#]/)[0];
  const ext = clean.includes(".") ? (clean.split(".").pop() ?? "").toLowerCase() : "";
  return MIME_BY_EXT[ext] ?? null;
}

/**
 * Pulls image URLs out of whatever was pasted.
 * - If it contains src="..." / data-src="..." / url(...) (HTML or CSS), those values are used.
 * - Otherwise every non-empty line is treated as a URL.
 */
export function extractUrls(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/(?:data-src|src)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)) {
    found.push((m[1] ?? m[2]).trim());
  }
  const list = found.length > 0 ? found : text.split(/\r?\n/).map((l) => l.trim());
  return [...new Set(list.filter(Boolean))];
}

export type Resolved = { kind: "url"; url: string } | { kind: "inline" } | { kind: "bad"; raw: string };

/** Turns a pasted value into an absolute https URL, using the base for relative paths. */
export function resolveUrl(raw: string, base: string): Resolved {
  const value = raw.trim();
  if (value.toLowerCase().startsWith("data:")) return { kind: "inline" };
  try {
    const u = new URL(value.startsWith("//") ? `https:${value}` : value, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return { kind: "bad", raw };
    u.protocol = "https:";
    return { kind: "url", url: u.toString() };
  } catch {
    return { kind: "bad", raw };
  }
}

export type OutputFormat = "dataurl" | "img" | "css";

export interface OutputOptions {
  format: OutputFormat;
  alt: string;
  width: string; // blank = use the image's own size
  height: string;
  spanPrefix: boolean; // old script printed "<span></span>" before each <img>
}

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function formatOutput(r: { dataUrl: string; width?: number; height?: number }, o: OutputOptions): string {
  if (o.format === "dataurl") return r.dataUrl;
  // Single quotes inside url() so it also works inside a double-quoted style="..." attribute.
  if (o.format === "css") return `background-image: url('${r.dataUrl}');`;

  const w = o.width.trim() || (r.width ? String(r.width) : "");
  const h = o.height.trim() || (r.height ? String(r.height) : "");
  const attrs = [`src="${r.dataUrl}"`];
  if (w) attrs.push(`width="${escapeAttr(w)}"`);
  if (h) attrs.push(`height="${escapeAttr(h)}"`);
  attrs.push(`alt="${escapeAttr(o.alt)}"`);
  return `${o.spanPrefix ? "<span></span>" : ""}<img ${attrs.join(" ")} />`;
}

export function formatBytes(n: number): string {
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** Normalizes the MIME type; returns null when the data is not an image. */
export function imageMime(blobType: string, nameHint: string): string | null {
  let t = blobType.split(";")[0].trim().toLowerCase();
  if (t === "image/jpg") t = "image/jpeg";
  if (t.startsWith("image/")) return t;
  if (t === "" || t === "application/octet-stream") return mimeFromName(nameHint);
  return null;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image data."));
    reader.readAsDataURL(blob);
  });
}

export function loadImageSize(dataUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export interface ImageResult {
  dataUrl: string;
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
}

/** Shared by URL and file conversion: checks it is an image, encodes it, reads its size. */
export async function blobToImageResult(blob: Blob, nameHint: string): Promise<ImageResult> {
  const mime = imageMime(blob.type, nameHint);
  if (!mime) {
    if (blob.type.includes("text/html")) {
      throw new Error(
        "Got a web page instead of an image. If you are running npm run dev, URL fetching needs the Worker: run npm run build, then npx wrangler dev.",
      );
    }
    throw new Error(`Not an image (type: ${blob.type || "unknown"}).`);
  }
  const typed = blob.type.split(";")[0].trim().toLowerCase() === mime ? blob : new Blob([blob], { type: mime });
  const dataUrl = await blobToDataUrl(typed);
  const size = await loadImageSize(dataUrl);
  return { dataUrl, mime, bytes: blob.size, width: size?.width, height: size?.height };
}

/** Fetches an image through the Worker (so the CDN sees the right Referer) and encodes it. */
export async function convertUrl(absoluteUrl: string): Promise<ImageResult> {
  const res = await fetch(`/api/fetch-image?url=${encodeURIComponent(absoluteUrl)}`);
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const data: { error?: string } = await res.json();
      if (data.error) message = data.error;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  return blobToImageResult(await res.blob(), absoluteUrl);
}

export async function convertFile(file: File): Promise<ImageResult> {
  return blobToImageResult(file, file.name);
}