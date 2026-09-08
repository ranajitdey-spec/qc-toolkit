export interface ConvertResult {
  originalKB: number;
  webpKB: number;
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

/**
 * Mirrors img.save(..., "WEBP", lossless=True, method=6) from the Python script.
 * lossless: 1 = no quality loss, matches lossless=True
 * method: 6 = best compression effort, matches method=6
 */
export async function convertToWebp(file: File): Promise<ConvertResult> {
  const { encode } = await import("@jsquash/webp");
  const img = await loadImage(file);

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const buffer = await encode(imageData, { lossless: 1, method: 6 });
  const blob = new Blob([buffer], { type: "image/webp" });

  return { originalKB: file.size / 1024, webpKB: blob.size / 1024, blob };
}