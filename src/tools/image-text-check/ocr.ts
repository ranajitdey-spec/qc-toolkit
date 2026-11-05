import { createWorker } from "tesseract.js";

export interface OcrWord {
  text: string;
  confidence: number; // 0-100, how sure the engine is about this word
}

export interface OcrLine {
  words: OcrWord[];
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// These files are copied into public/tesseract by scripts/copy-ocr-assets.mjs,
// so the site serves them itself instead of relying on a public CDN.
const BASE = "/tesseract";

type OcrWorker = Awaited<ReturnType<typeof createWorker>>;

let workerPromise: Promise<OcrWorker> | null = null;
let onStatus: ((status: string, progress: number) => void) | null = null;

function getWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng", 1, {
      workerPath: `${BASE}/worker.min.js`,
      corePath: `${BASE}/core`,
      langPath: `${BASE}/lang`,
      logger: (m) => onStatus?.(m.status, m.progress),
    }).catch((err) => {
      workerPromise = null; // allow a retry after a failure
      throw err;
    });
  }
  return workerPromise;
}

/** Reads the whole image, or just the given rectangle (in the image's own pixels). */
export async function readImageText(
  image: File,
  rect: Rect | null,
  status: (status: string, progress: number) => void,
): Promise<OcrLine[]> {
  onStatus = status;
  const worker = await getWorker();
  const { data } = await worker.recognize(image, rect ? { rectangle: rect } : {}, { blocks: true });

  const lines: OcrLine[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        const words = line.words
          .map((w) => ({ text: w.text.trim(), confidence: w.confidence }))
          .filter((w) => w.text.length > 0);
        if (words.length > 0) lines.push({ words });
      }
    }
  }
  return lines;
}