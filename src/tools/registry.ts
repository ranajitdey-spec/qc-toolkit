import { lazy } from "react";

export interface ToolMeta {
  id: string;
  path: string;
  name: string;
  description: string;
  component: ReturnType<typeof lazy>;
}

// Add a new tool here: one line, pointing at its folder's index.tsx.
// Nothing else needs to change for it to show up in nav + routing.
export const tools: ToolMeta[] = [
  {
    id: "delimiter-table",
    path: "/tools/delimiter-table",
    name: "Delimiter + Table",
    description: "Paste space-separated column names — get a delimited string and a terminal-style table.",
    component: lazy(() => import("./delimiter-table")),
  },
  {
    id: "text-to-html",
    path: "/tools/text-to-html",
    name: "Text to HTML",
    description: "Fill a hardcoded HTML template from pasted text.",
    component: lazy(() => import("./text-to-html")),
  },
  {
    id: "image-compress",
    path: "/tools/image-compress",
    name: "Image Compress",
    description: "Compress images client-side without visible quality loss.",
    component: lazy(() => import("./image-compress")),
  },
   {
    id: "convert-webp",
    path: "/tools/convert-webp",
    name: "Convert to WebP",
    description: "Batch-convert JPG/PNG to lossless WebP, client-side.",
    component: lazy(() => import("./convert-webp")),
  },
    {
    id: "card-scraper",
    path: "/tools/card-scraper",
    name: "Card Details",
    description: "Extract video/image assets and metadata from a card page.",
    component: lazy(() => import("./card-scraper")),
  },
  {
    id: "app-card",
    path: "/tools/app-card",
    name: "App Card Details",
    description: "Extract Q1, font color, tags, red line, and green line from an App Only Card email.",
    component: lazy(() => import("./app-card")),
  },
];
