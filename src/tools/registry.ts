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
];
