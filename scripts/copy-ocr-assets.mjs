// Copies the OCR engine files out of node_modules into public/tesseract so the site serves
// them itself (no third-party CDN needed at runtime). Runs automatically before dev and build.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const out = join("public", "tesseract");
const worker = join("node_modules", "tesseract.js", "dist", "worker.min.js");
const coreDir = join("node_modules", "tesseract.js-core");
const lang = join("node_modules", "@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz");

for (const p of [worker, coreDir, lang]) {
  if (!existsSync(p)) {
    console.error(`copy-ocr-assets: missing ${p}. Run: npm install tesseract.js @tesseract.js-data/eng`);
    process.exit(1);
  }
}

mkdirSync(join(out, "core"), { recursive: true });
mkdirSync(join(out, "lang"), { recursive: true });
cpSync(worker, join(out, "worker.min.js"));
for (const f of readdirSync(coreDir)) {
  if (f.endsWith(".wasm.js")) cpSync(join(coreDir, f), join(out, "core", f));
}
cpSync(lang, join(out, "lang", "eng.traineddata.gz"));
console.log("copy-ocr-assets: OCR files copied to public/tesseract");