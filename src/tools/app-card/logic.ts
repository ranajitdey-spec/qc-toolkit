export interface ParsedCardEmail {
  q1: string | null;
  fontColor: string | null;
  cardTags: string | null;
  redLine: string | null;
  greenLine: string | null;
}

function extractLine(text: string, label: RegExp): string | null {
  const m = text.match(label);
  return m ? m[1].trim() : null;
}

/** Capitalizes the first letter and removes any space(s) before a trailing full stop. */
function cleanLine(text: string | null): string | null {
  if (!text) return text;
  let t = text.trim();
  if (t.length === 0) return t;
  t = t.charAt(0).toUpperCase() + t.slice(1);
  t = t.replace(/\s+\.$/, ".");
  return t;
}

export function parseCardEmail(raw: string): ParsedCardEmail {
  const q1 = extractLine(raw, /Q1 Value\s*:\s*(.+)/i);
  const fontColor = extractLine(raw, /Choose Font Color\s*:\s*(.+)/i);
  const cardTags = extractLine(raw, /Card [Tt]ags\s*:\s*(.+)/i);
  const redLineRaw = extractLine(raw, /Red Line\s*:\s*(.+)/i);
  const greenLineRaw = extractLine(raw, /Green Line\s*:\s*(.+)/i);

  return {
    q1,
    fontColor,
    cardTags,
    redLine: cleanLine(redLineRaw),
    greenLine: cleanLine(greenLineRaw),
  };
}

// ---------- File classification / renaming ----------

export type FileCategory = "video" | "bg" | "th" | "icon" | "unrecognized";

export interface ClassifiedFile {
  id: string;
  file: File;
  category: FileCategory;
  newName: string | null;
  needsIconBaseName?: boolean;
  dims?: { width: number; height: number };
}

function fileExt(filename: string): string {
  const m = filename.match(/\.[^.]+$/);
  return m ? m[0].toLowerCase() : "";
}

function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Mirrors the Python script's dimension-based classification:
 * mp4 -> video, 100x100 -> bg, 115x115 -> thumb, 60x60 -> icon
 * (icon renumbering: prefix-N -> prefix-(N+10), or flagged for manual base name).
 * Anything else is left unrecognized, original name untouched, for you to review.
 */
export async function classifyFiles(files: File[], baseId: string): Promise<ClassifiedFile[]> {
  const results: ClassifiedFile[] = [];

  for (const file of files) {
    const id = crypto.randomUUID();
    const ext = fileExt(file.name);

    if (ext === ".mp4") {
      results.push({ id, file, category: "video", newName: `${baseId}.mp4` });
      continue;
    }

    const dims = await getImageDimensions(file);
    if (!dims) {
      results.push({ id, file, category: "unrecognized", newName: null });
      continue;
    }
    const { width, height } = dims;

    if (width === 100 && height === 100) {
      results.push({ id, file, category: "bg", newName: `${baseId}_bg${ext}`, dims });
    } else if (width === 115 && height === 115) {
      results.push({ id, file, category: "th", newName: `${baseId}_th${ext}`, dims });
    } else if (width === 60 && height === 60) {
      const nameOnly = file.name.replace(/\.[^.]+$/, "");
      const m = nameOnly.match(/^(.+)-(\d+)$/);
      if (m) {
        const newNumber = parseInt(m[2], 10) + 10;
        results.push({ id, file, category: "icon", newName: `${m[1]}-${newNumber}${ext}`, dims });
      } else {
        results.push({ id, file, category: "icon", newName: null, needsIconBaseName: true, dims });
      }
    } else {
      results.push({ id, file, category: "unrecognized", newName: null, dims });
    }
  }

  return results;
}

/** Applies the same prefix-N -> prefix-(N+10) rule to a manually entered icon base name. */
export function applyIconBaseName(userInput: string, ext: string): string | null {
  const cleaned = userInput.replace(/\.[^.]+$/, "").trim();
  const m = cleaned.match(/^(.+)-(\d+)$/);
  if (!m) return null;
  const newNumber = parseInt(m[2], 10) + 10;
  return `${m[1]}-${newNumber}${ext}`;
}

// ---------- Video frame capture ----------

/** Draws the video's current frame onto a canvas and encodes it as JPEG at a light compression level. */
export function captureVideoFrame(video: HTMLVideoElement, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas context unavailable"));
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      quality,
    );
  });
}