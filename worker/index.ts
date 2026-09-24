export interface Env {
  ASSETS: Fetcher;
}

interface AssetItem {
  type: string;
  url: string;
  filename: string;
}

function isValidCardUrl(u: string): boolean {
  return /^https?:\/\/(www\.|m\.)?123greetings\.com\/([a-z0-9_]+\/)+[a-z0-9_]+\.html(\?.*)?$/i.test(u);
}
function matchOne(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function filenameOf(assetUrl: string): string {
  try {
    return new URL(assetUrl).pathname.split("/").pop() || "file";
  } catch {
    return "file";
  }
}

function categorize(assetUrl: string): string {
  if (/\/thumb\//i.test(assetUrl)) return "thumb";
  if (/\/icon/i.test(assetUrl)) return "icon";
  if (assetUrl.endsWith(".mp4")) return "video";
  return "other";
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function guessAsset(subCatQ1: string, cardId: string, kind: "th" | "ic"): Promise<AssetItem | null> {
  for (const ext of ["jpg", "png"]) {
    const url = `https://i.123g.us/c/${subCatQ1}/${kind}/${cardId}_${kind}.${ext}`;
    try {
      const res = await fetch(url, {
        method: "HEAD",
        headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.123greetings.com/" },
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (res.ok && contentType.startsWith("image/")) {
        return { type: kind === "th" ? "thumb" : "icon", url, filename: `${cardId}_${kind}.${ext}` };
      }
    } catch {
      // try next extension
    }
  }
  return null;
}

async function handleExtract(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const cardUrl = url.searchParams.get("url") ?? "";

  

  if (!isValidCardUrl(cardUrl)) {
    return json({ valid: false, error: "Not a recognized 123greetings card URL." }, 400);
  }

  let res: Response;
  try {
    res = await fetch(cardUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  } catch {
    return json({ valid: false, error: "Could not reach that URL." }, 502);
  }
  if (!res.ok) {
    return json({ valid: false, error: `Page returned ${res.status}` }, 502);
  }

  const html = await res.text();
  console.log("Fetched length:", html.length, "Snippet:", html.slice(0, 200));
  console.log("Fetched length:", html.length);
  console.log("Has title tag:", /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? "NONE FOUND");
  console.log("Has cat_q1 marker:", html.includes("cat_q1"));
  console.log("Has breadcrumb:", html.includes("breadcrumb_new"));
  console.log("Full snippet:", html.slice(0, 1500));




  const title = matchOne(html, /<li>\s*<h1>([^<]+)<\/h1>\s*<\/li>/i);
  const subtitle = matchOne(html, /<h2 class="seo-list">([^<]+)<\/h2>/i);
  const uploadDate = matchOne(html, /"uploadDate":"([^"]+)"/);

  const genMatch = html.match(/<!--\s*Generated on\s+([\d/]+\s+[\d:]+)\s*\|\s*Version\s*:\s*([\d.]+)\s*-->/i);
  const generatedDate = genMatch?.[1]?.trim() ?? null;
  const generatedVersion = genMatch?.[2]?.trim() ?? null;

  const mp4 = matchOne(html, /v_file_mp4:"([^"]+)"/);
  const pc = matchOne(html, /<meta property="og:image" content="([^"]+)"/i);
  const catQ1 = matchOne(html, /var cat_q1\s*=\s*'([^']*)'/);
  const subCatQ1 = matchOne(html, /var sub_cat_q1\s*=\s*'([^']*)'/);
  const cardId = matchOne(html, /var card_id\s*=\s*'([^']*)'/);

  const assets: AssetItem[] = [];
  if (mp4) assets.push({ type: "video", url: mp4, filename: filenameOf(mp4) });
  if (pc) assets.push({ type: "pc", url: pc, filename: filenameOf(pc) });

  if (subCatQ1 && cardId) {
    const [thumb, icon] = await Promise.all([
      guessAsset(subCatQ1, cardId, "th"),
      guessAsset(subCatQ1, cardId, "ic"),
    ]);
    if (thumb) assets.push(thumb);
    if (icon) assets.push(icon);
  }

  const seen = new Set(assets.map((a) => a.url));
  for (const m of html.matchAll(/https:\/\/i\.123g\.us\/[^\s"'<>]+/g)) {
    const assetUrl = m[0];
    if (seen.has(assetUrl)) continue;
    seen.add(assetUrl);
    assets.push({ type: categorize(assetUrl), url: assetUrl, filename: filenameOf(assetUrl) });
  }

   return json({ valid: true, url: cardUrl, title, subtitle, uploadDate, generatedDate, generatedVersion, catQ1, subCatQ1, cardId, assets });
}

async function handleDownload(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const assetUrl = url.searchParams.get("url") ?? "";
  const filename = url.searchParams.get("filename") || "download";

  if (!/^https:\/\/i\.123g\.us\//.test(assetUrl)) {
    return new Response("Invalid asset URL", { status: 400 });
  }

   const res = await fetch(assetUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://www.123greetings.com/",
    },
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !res.body || contentType.includes("text/html")) {
    return new Response("Could not fetch asset (blocked or not found)", { status: 502 });
  }

  const inline = url.searchParams.get("inline") === "1";
  const headers = new Headers(res.headers);
  headers.set("content-disposition", `${inline ? "inline" : "attachment"}; filename="${filename.replace(/"/g, "")}"`);
  return new Response(res.body, { status: 200, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/extract-card") return handleExtract(request);
    if (url.pathname === "/api/extract-pc") return handleExtractPc(request);
    if (url.pathname === "/api/download-asset") return handleDownload(request);
    return env.ASSETS.fetch(request);
  },

};

async function handleExtractPc(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const cardUrl = url.searchParams.get("url") ?? "";

  if (!isValidCardUrl(cardUrl)) {
    return json({ valid: false, error: "Not a recognized 123greetings card URL." }, 400);
  }

  let res: Response;
  try {
    res = await fetch(cardUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  } catch {
    return json({ valid: false, error: "Could not reach that URL." }, 502);
  }
  if (!res.ok) {
    return json({ valid: false, error: `Page returned ${res.status}` }, 502);
  }

  const html = await res.text();
  const pcUrl = matchOne(html, /<meta property="og:image" content="([^"]+)"/i);

  if (!pcUrl) {
    return json({ valid: false, error: "No _pc image found on that page." }, 404);
  }

  const filename = pcUrl.split("/").pop() || "pc.jpg";
  return json({ valid: true, pcUrl, filename });
}