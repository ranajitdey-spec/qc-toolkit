import type { TourStep } from "../../lib/tour";

export const imageCompressTour: TourStep[] = [
  {
    element: "#file-input",
    popover: {
      title: "Upload your images",
      description: "Select multiple files at once — each gets its own row below.",
    },
  },
  {
    element: "#max-size",
    popover: {
      title: "Default target size",
      description: "Applied to every image unless you override it for a specific one — see the next step.",
    },
  },
  {
    popover: {
      title: "Per-image targets — the real feature here",
      description:
        "Once you've uploaded files, each row gets its own \"Target (KB)\" box. Leave it blank to use the default above, or type a number to compress just that image to a different size. Upload a batch, compress most to 300 KB and a couple to 150 KB, all in one run.",
    },
  },
  {
    element: "#compress-btn",
    popover: {
      title: "Run it",
      description: "Compresses every selected row, each to its own target — default or overridden.",
    },
  },
];