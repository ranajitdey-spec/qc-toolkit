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

// ---------- Multi-pass reading ----------
// The engine decides one "typical text size" per image. A big headline next to small body text
// breaks that assumption, so a thorough read looks at the same area several ways:
//   1x plain          - best for normal-size text
//   0.5x plain        - makes big headline lettering look normal-sized to the engine
//   2x + contrast     - helps thin or script-style lettering
// Then, for each spot on the image, the most convincing reading wins.

interface Pass {
  scale: number;
  enhance: boolean;
}

const FAST_PASSES: Pass[] = [{ scale: 1, enhance: false }];
const THOROUGH_PASSES: Pass[] = [
  { scale: 1, enhance: false },
  { scale: 0.5, enhance: false },
  { scale: 2, enhance: true },
];
const MAX_SIDE = 2600; // keeps the enlarged pass from getting huge on big images

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/** Grayscale, then stretch contrast so the darkest 1% becomes black and the lightest 1% white. */
function enhanceContrast(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const hist = new Array<number>(256).fill(0);

  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = g;
    d[i + 1] = g;
    d[i + 2] = g;
    hist[g]++;
  }

  const total = w * h;
  let lo = 0;
  let hi = 255;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= total * 0.01) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= total * 0.01) {
      hi = v;
      break;
    }
  }

  if (hi - lo >= 20) {
    const k = 255 / (hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.max(0, Math.min(255, (d[i] - lo) * k));
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function renderPass(img: HTMLImageElement, rect: Rect | null, pass: Pass): { canvas: HTMLCanvasElement; scale: number } | null {
  const sx = rect?.left ?? 0;
  const sy = rect?.top ?? 0;
  const sw = rect?.width ?? img.naturalWidth;
  const sh = rect?.height ?? img.naturalHeight;

  let scale = pass.scale;
  if (Math.max(sw, sh) * scale > MAX_SIDE) scale = MAX_SIDE / Math.max(sw, sh);

  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  if (w < 40 || h < 20) return null; // too small to be worth reading

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff"; // so transparent PNGs don't turn black
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  if (pass.enhance) enhanceContrast(ctx, w, h);

  return { canvas, scale };
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Candidate {
  words: OcrWord[];
  box: Box; // in the coordinates of the original (unscaled) area
  score: number;
}

const ALNUM = /[\p{L}\p{N}]/gu;
const countAlnum = (s: string) => s.match(ALNUM)?.length ?? 0;

/** Letters and digits read, weighted by how sure the engine was. A complete, confident line scores high. */
function lineScore(words: OcrWord[]): number {
  return words.reduce((sum, w) => sum + countAlnum(w.text) * (w.confidence / 100), 0);
}

function overlapRatio(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const smaller = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
  return smaller > 0 ? (ix * iy) / smaller : 0;
}

/** Where two readings cover the same spot, keep the higher-scoring one. Result is in reading order. */
function mergeCandidates(all: Candidate[]): OcrLine[] {
  const kept: Candidate[] = [];
  for (const c of [...all].sort((a, b) => b.score - a.score)) {
    if (!kept.some((k) => overlapRatio(k.box, c.box) > 0.5)) kept.push(c);
  }
  kept.sort((a, b) => a.box.y0 - b.box.y0 || a.box.x0 - b.box.x0);
  return kept.map((k) => ({ words: k.words }));
}

/** Reads the whole image, or just the given rectangle (in the image's own pixels). */
export async function readImageText(
  image: File,
  rect: Rect | null,
  thorough: boolean,
  status: (message: string) => void,
): Promise<OcrLine[]> {
  onStatus = (s, p) => status(`${s} ${Math.round(p * 100)}%`);
  const worker = await getWorker();
  const img = await loadImage(image);
  const passes = thorough ? THOROUGH_PASSES : FAST_PASSES;
  const candidates: Candidate[] = [];

  for (let i = 0; i < passes.length; i++) {
    const rendered = renderPass(img, rect, passes[i]);
    if (!rendered) continue;

    onStatus = (s, p) => status(`Pass ${i + 1} of ${passes.length}: ${s} ${Math.round(p * 100)}%`);
    const { data } = await worker.recognize(rendered.canvas, {}, { blocks: true });

    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          const words = line.words
            .map((w) => ({ text: w.text.trim(), confidence: w.confidence }))
            .filter((w) => w.text.length > 0);
          const score = lineScore(words);
          if (score <= 0) continue; // lines with no letters or digits are just symbol noise

          const s = rendered.scale;
          candidates.push({
            words,
            score,
            box: { x0: line.bbox.x0 / s, y0: line.bbox.y0 / s, x1: line.bbox.x1 / s, y1: line.bbox.y1 / s },
          });
        }
      }
    }
  }

  if (passes.length === 1) return candidates.map((c) => ({ words: c.words }));
  return mergeCandidates(candidates);
}