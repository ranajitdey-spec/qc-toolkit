export interface CompressResult {
  quality: number;
  originalKB: number;
  finalKB: number;
  reductionPct: number;
  blob: Blob;
}

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

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/jpeg", quality);
  });
}

/**
 * Mirrors compress_jpg from the Python script:
 * - if already under the target size, re-save at quality 100 (matches quality=100, subsampling=0)
 * - otherwise step quality down from 95 in increments of 5, stopping at 15,
 *   until the file fits under the target size (matches the while quality>10 loop,
 *   which in practice never saves below quality 15)
 * - flattens transparency onto white, same as the PIL RGBA/LA/P handling
 */
export async function compressToTarget(file: File, maxSizeKB: number): Promise<CompressResult> {
  const originalKB = file.size / 1024;
  const img = await loadImage(file);

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  if (originalKB <= maxSizeKB) {
    const blob = await canvasToBlob(canvas, 1.0);
    return { quality: 100, originalKB, finalKB: blob.size / 1024, reductionPct: 0, blob };
  }

  let quality = 95;
  let blob = await canvasToBlob(canvas, quality / 100);
  while (blob.size / 1024 > maxSizeKB && quality > 15) {
    quality -= 5;
    blob = await canvasToBlob(canvas, quality / 100);
  }

  const finalKB = blob.size / 1024;
  const reductionPct = ((originalKB - finalKB) / originalKB) * 100;
  return { quality, originalKB, finalKB, reductionPct, blob };
}