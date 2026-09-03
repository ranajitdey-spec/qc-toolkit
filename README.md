# QC Toolkit

Personal, static, client-side toolkit. No backend, no API keys, nothing uploaded anywhere — everything runs in the browser.

## Run locally

```
npm install
npm run dev
```

## Add a new tool

1. Copy `src/tools/_template/` to `src/tools/<your-tool-name>/`
2. Write the real logic in `logic.ts` (pure functions, no JSX — keeps it testable and keeps UI dumb)
3. Build the UI in `index.tsx`, using `src/tools/shared.module.css` for form controls/output blocks
4. Add one entry to `src/tools/registry.ts` — this alone adds it to the nav and gives it a route

That's it. Each tool is its own route (`/tools/<name>`) and its own lazy-loaded bundle, so tools never affect each other and unused tool code never loads.

## Logging (currently a no-op)

`src/lib/log.ts` exports `logEvent(toolId, action, meta?)`. It's a single hook point for a future logging system — call it from a tool when something meaningful happens. Today it just logs to the console in dev. When you want real logging later, swap the inside of that one function (Cloudflare Worker + KV, Supabase, whatever) — no tool code needs to change.

## Deploy

Static site, no serverless functions needed. Either works identically:

**Vercel**: import the GitHub repo, framework preset "Vite", defaults are fine.

**Cloudflare Pages**: connect the GitHub repo, build command `npm run build`, output directory `dist`.

Both auto-deploy on push to `main`.

## Why no backend

Every tool here only transforms data already in the browser (text, or a file you pick). Image compression uses WASM-based codecs (`@jsquash/jpeg`) that match Pillow's output quality without a server round-trip. A backend only becomes necessary if a future tool needs a secret API key, cross-device persistence, or a library with no JS/WASM equivalent — none of the current tools do.
