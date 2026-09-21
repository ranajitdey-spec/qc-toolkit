import type { TourStep } from "../../lib/tour";

export const delimiterTableTour: TourStep[] = [
  {
    element: "#input",
    popover: {
      title: "Paste your columns",
      description: "Type or paste space-separated values here. First line becomes the header row.",
    },
  },
  {
    element: "#csv",
    popover: {
      title: "Or upload a CSV",
      description: "Uploading a file takes over from the textarea automatically — click Clear to go back to pasting.",
    },
  },
  {
    element: "#delimiter",
    popover: {
      title: "Pick a delimiter",
      description: "Controls how the delimited-output box below joins each row's values.",
    },
  },
  {
    element: "#delimited-output",
    popover: {
      title: "Delimited output",
      description: "Ready to paste straight into a spreadsheet or ticket field.",
    },
  },
  {
    element: "#table-output",
    popover: {
      title: "Terminal table",
      description: "A monospaced table, handy for pasting into tickets that need a fixed-width layout.",
    },
  },
];